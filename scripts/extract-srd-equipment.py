from pypdf import PdfReader
import json
import re
from pathlib import Path

ROOT = Path(r"C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next")
PDF_PATH = Path(r"C:\Users\Rowan\Desktop\Adversary Builder Package\DH-SRD-May202025.pdf")
OUT_DIR = ROOT / "src" / "lib" / "data" / "equipment"

TRAITS = {
    "Agility": "agility",
    "Strength": "strength",
    "Finesse": "finesse",
    "Instinct": "instinct",
    "Presence": "presence",
    "Knowledge": "knowledge",
    "Spellcast": "spellcast",
}
RANGES = {
    "Melee": "melee",
    "Close": "close",
    "Far": "far",
    "Very Close": "very_close",
    "Very Far": "very_far",
}

DAMAGE_TYPES = {"phy": "physical", "mag": "magical"}
BURDEN_MAP = {"One-Handed": 1, "Two-Handed": 2}

HEADER_PHRASES = {
    "PRIMARY WEAPON TABLES",
    "SECONDARY WEAPON TABLES",
    "Physical Weapons",
    "Magic Weapons",
    "ARMOR TABLES",
    "ARMOR",
    "LOOT",
    "Consumables",
    "Name Trait Range Damage Burden Feature",
    "Name Tier Trait Range Damage Burden Feature",
    "Name",
    "Base",
    "Thresholds",
    "Score Feature",
    "ROLL Loot description",
    "ROLL LOOT description",
}

SPECIAL_SKIP = {
    "Daggerheart SRD",
}


def normalize_line(line: str) -> str:
    line = line.replace("\u2212", "-")  # minus
    line = line.replace("\u2013", "-")  # en dash
    line = line.replace("\u2014", "-")  # em dash
    line = re.sub(r"\s+", " ", line).strip()
    return line


def extract_lines(reader: PdfReader, start: int, end: int):
    pages = []
    for idx in range(start, end + 1):
        text = reader.pages[idx].extract_text() or ""
        lines = [normalize_line(l) for l in text.splitlines() if normalize_line(l)]
        page_num = None
        for i in range(len(lines) - 1):
            if lines[i].isdigit() and lines[i + 1].lower().startswith("daggerheart"):
                page_num = int(lines[i])
        if page_num is None:
            page_num = idx + 1
        pages.append((page_num, lines))
    return pages


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def looks_like_name_fragment(line: str) -> bool:
    if not line or not line[0].isupper():
        return False
    if re.search(r"[.:;]", line):
        return False
    words = line.split()
    return len(words) <= 3


def parse_weapon_line(line: str):
    tokens = line.split()
    # Find trait token position
    for i, tok in enumerate(tokens):
        if tok in TRAITS:
            # parse range (may be 2 tokens)
            if i + 1 >= len(tokens):
                return None
            if tokens[i + 1] == "Very" and i + 2 < len(tokens):
                range_token = f"Very {tokens[i + 2]}"
                range_len = 2
            else:
                range_token = tokens[i + 1]
                range_len = 1
            if range_token not in RANGES:
                continue
            dmg_index = i + 1 + range_len
            if dmg_index >= len(tokens):
                return None
            damage = tokens[dmg_index]
            if not re.match(r"^d\d+(\+\d+)?$", damage):
                continue
            if dmg_index + 1 >= len(tokens):
                return None
            dmg_type = tokens[dmg_index + 1]
            if dmg_type not in DAMAGE_TYPES:
                continue
            if dmg_index + 2 >= len(tokens):
                return None
            burden = tokens[dmg_index + 2]
            if burden not in BURDEN_MAP:
                continue
            name_part = " ".join(tokens[:i]).strip()
            feature = " ".join(tokens[dmg_index + 3 :]).strip()
            return {
                "name_part": name_part,
                "trait": TRAITS[tok],
                "range": RANGES[range_token],
                "damage": damage,
                "damage_type": DAMAGE_TYPES[dmg_type],
                "burden": BURDEN_MAP[burden],
                "feature": feature,
                "trait_raw": tok,
            }
    return None


def parse_armor_line(line: str):
    m = re.match(r"^(?P<name>.+?)\s+(?P<major>\d+)\s*/\s*(?P<severe>\d+)\s+(?P<score>\d+)\s+(?P<feature>.+)$", line)
    if not m:
        return None
    return {
        "name_part": m.group("name").strip(),
        "major": int(m.group("major")),
        "severe": int(m.group("severe")),
        "score": int(m.group("score")),
        "feature": m.group("feature").strip(),
    }


def parse_modifiers(feature: str):
    modifiers = {}
    traits = {}
    feature_norm = feature.replace("−", "-")
    # Evasion
    for m in re.finditer(r"([+-]\d+) to Evasion", feature_norm, re.I):
        modifiers["evasion"] = modifiers.get("evasion", 0) + int(m.group(1))
    # Armor Score
    for m in re.finditer(r"([+-]\d+) to Armor Score", feature_norm, re.I):
        modifiers["armorScore"] = modifiers.get("armorScore", 0) + int(m.group(1))
    # Thresholds
    for m in re.finditer(r"([+-]\d+) to Major Threshold", feature_norm, re.I):
        modifiers["majorThreshold"] = modifiers.get("majorThreshold", 0) + int(m.group(1))
    for m in re.finditer(r"([+-]\d+) to Severe Threshold", feature_norm, re.I):
        modifiers["severeThreshold"] = modifiers.get("severeThreshold", 0) + int(m.group(1))
    # Trait modifiers
    for trait_label, trait_key in TRAITS.items():
        if trait_key == "spellcast":
            continue
        for m in re.finditer(rf"([+-]\d+) to {trait_label}", feature_norm, re.I):
            traits[trait_key] = traits.get(trait_key, 0) + int(m.group(1))
    # All traits
    if re.search(r"-1 to all character traits", feature_norm, re.I):
        for trait_key in ("agility", "strength", "finesse", "instinct", "presence", "knowledge"):
            traits[trait_key] = traits.get(trait_key, 0) - 1
        if re.search(r"and Evasion", feature_norm, re.I):
            modifiers["evasion"] = modifiers.get("evasion", 0) - 1
    if traits:
        modifiers["traits"] = traits
    return modifiers


def weapon_entry_from_row(row, category, tier, source_page, subtype="standard", requires_spellcast=False):
    name = row["name"].strip()
    feature = row["feature"].strip()
    if feature in {"-", "—"}:
        feature = ""
    modifiers = parse_modifiers(feature)
    slug = slugify(name)
    return {
        "id": f"weapon-{slug}",
        "lineageKey": f"weapon-{slug}",
        "slug": slug,
        "name": name,
        "tier": tier,
        "weaponCategory": category,
        "weaponSubtype": subtype,
        "requiresSpellcast": requires_spellcast or row["trait"] == "spellcast" or row["damage_type"] == "magical",
        "burdenHands": row["burden"],
        "defaultProfile": {
            "label": "Standard Attack",
            "traitMode": row["trait"],
            "rangeBand": row["range"],
            "damageFormula": row["damage"],
            "damageType": row["damage_type"],
        },
        "alternateProfiles": [],
        "sheetModifiers": modifiers,
        "featureName": None,
        "featureText": feature,
        "tags": ["weapon", category, row["damage_type"]],
        "sourceBook": "DH-SRD-May202025",
        "sourcePage": source_page,
    }


def armor_entry_from_row(row, tier, source_page):
    name = row["name"].strip()
    feature = row["feature"].strip()
    if feature in {"-", "—"}:
        feature = ""
    modifiers = parse_modifiers(feature)
    slug = slugify(name)
    return {
        "id": f"armor-{slug}",
        "lineageKey": f"armor-{slug}",
        "slug": slug,
        "name": name,
        "tier": tier,
        "baseMajorThreshold": row["major"],
        "baseSevereThreshold": row["severe"],
        "baseArmorScore": row["score"],
        "sheetModifiers": modifiers,
        "featureName": None,
        "featureText": feature,
        "tags": ["armor"],
        "sourceBook": "DH-SRD-May202025",
        "sourcePage": source_page,
    }


def classify_item(name: str, description: str):
    lowered = name.lower()
    desc_lower = description.lower()
    category = "loot"
    can_equip = False
    equip_label = None
    if "recipe" in lowered:
        category = "recipe"
    if any(word in lowered for word in ["ring", "amulet", "pendant", "cloak", "locket", "belt", "charm", "brooch", "bracelet", "necklace"]):
        category = "wearable"
        can_equip = True
        equip_label = "Accessory"
    if "attach" in desc_lower and "weapon" in desc_lower:
        category = "attachment"
        can_equip = True
        equip_label = "Weapon Attachment"
    if "attach" in desc_lower and "armor" in desc_lower:
        category = "attachment"
        can_equip = True
        equip_label = "Armor Attachment"
    if "tool" in lowered:
        category = "tool"
    return category, can_equip, equip_label


def classify_consumable(name: str):
    lowered = name.lower()
    if "potion" in lowered:
        return "potion"
    if "venom" in lowered:
        return "poison"
    if "salve" in lowered:
        return "salve"
    if "bomb" in lowered or "powder" in lowered or "shard" in lowered:
        return "bomb"
    if "tea" in lowered or "feast" in lowered or "leaves" in lowered or "root" in lowered or "honey" in lowered or "moss" in lowered:
        return "food"
    if "scroll" in lowered or "parchment" in lowered:
        return "scroll"
    return "other"


def parse_loot_entries(lines):
    entries = []
    current = None
    for line in lines:
        if line in SPECIAL_SKIP:
            continue
        if line.startswith("GOLD"):
            break
        m = re.match(r"^(\d{1,2})\s+(.*)$", line)
        if m:
            if current:
                entries.append(current)
            current = {"roll": int(m.group(1)), "text": m.group(2)}
        else:
            if current:
                current["text"] += " " + line
    if current:
        entries.append(current)
    return entries


def split_name_desc(text: str):
    markers = [
        " This ",
        " You ",
        " When ",
        " During ",
        " Once ",
        " As ",
        " While ",
        " Spend ",
        " Activate ",
        " After ",
        " If ",
        " By ",
    ]
    for marker in markers:
        idx = text.find(marker)
        if idx > 0:
            return text[:idx].strip(), text[idx:].strip()
    return text.strip(), ""


def build_items_from_entries(entries, source_page):
    items = []
    for entry in entries:
        name, description = split_name_desc(entry["text"])
        category, can_equip, equip_label = classify_item(name, description)
        slug = slugify(name)
        items.append(
            {
                "id": f"item-{slug}",
                "lineageKey": f"item-{slug}",
                "slug": slug,
                "name": name,
                "rarity": "common",
                "rollValue": entry["roll"],
                "itemCategory": category,
                "canEquip": can_equip,
                "equipLabel": equip_label,
                "stackLimit": 1,
                "sheetModifiers": {},
                "usagePayload": {},
                "rulesText": description,
                "tags": ["item", "loot"],
                "sourceBook": "DH-SRD-May202025",
                "sourcePage": source_page,
            }
        )
    return items


def build_consumables_from_entries(entries, source_page):
    consumables = []
    for entry in entries:
        name, description = split_name_desc(entry["text"])
        slug = slugify(name)
        consumables.append(
            {
                "id": f"consumable-{slug}",
                "lineageKey": f"consumable-{slug}",
                "slug": slug,
                "name": name,
                "rarity": "common",
                "rollValue": entry["roll"],
                "consumableCategory": classify_consumable(name),
                "stackLimit": 5,
                "usagePayload": {},
                "rulesText": description,
                "tags": ["consumable"],
                "sourceBook": "DH-SRD-May202025",
                "sourcePage": source_page,
            }
        )
    return consumables


def extract_weapons(reader):
    pages = extract_lines(reader, 44, 53)
    weapons = []
    current_category = None
    current_tier = None
    current_magic = False
    current_subtype = "standard"
    name_parts = []
    current_row = None

    def flush_row():
        nonlocal current_row
        if current_row:
            weapons.append(current_row)
            current_row = None

    for page_num, lines in pages:
        for line in lines:
            if not line or line in SPECIAL_SKIP:
                continue
            if line.isdigit():
                continue
            if line in HEADER_PHRASES:
                flush_row()
                name_parts = []
                continue
            if line.startswith("PRIMARY WEAPON TABLES"):
                current_category = "primary"
                current_subtype = "standard"
                current_magic = False
                flush_row()
                name_parts = []
                continue
            if line.startswith("SECONDARY WEAPON TABLES"):
                current_category = "secondary"
                current_subtype = "standard"
                current_magic = False
                flush_row()
                name_parts = []
                continue
            if line.startswith("TIER "):
                m = re.match(r"TIER\s+(\d+)", line)
                if m:
                    current_tier = int(m.group(1))
                flush_row()
                name_parts = []
                continue
            if line == "Physical Weapons":
                current_magic = False
                continue
            if line == "Magic Weapons":
                current_magic = True
                continue
            if line.startswith("Combat Wheelchair"):
                current_category = "primary"
                current_subtype = "combat_wheelchair"
                current_magic = False
                flush_row()
                name_parts = []
                continue
            if line.endswith("Frame Models"):
                current_category = "primary"
                current_subtype = "combat_wheelchair"
                current_magic = "Arcane" in line
                flush_row()
                name_parts = []
                continue

            parsed = parse_weapon_line(line)
            if parsed:
                flush_row()
                name = " ".join([part for part in name_parts if part] + [parsed["name_part"]]).strip()
                if not name:
                    name = parsed["name_part"].strip()
                name_parts = []
                row_tier = current_tier or 1
                if current_subtype == "combat_wheelchair":
                    m = re.search(r"\b(\d+)\b$", name)
                    if m:
                        row_tier = int(m.group(1))
                        name = name[: m.start()].strip()
                current_row = weapon_entry_from_row(
                    {
                        "name": name,
                        "trait": parsed["trait"],
                        "range": parsed["range"],
                        "damage": parsed["damage"],
                        "damage_type": parsed["damage_type"],
                        "burden": parsed["burden"],
                        "feature": parsed["feature"],
                    },
                    category=current_category or "primary",
                    tier=row_tier,
                    source_page=page_num,
                    subtype=current_subtype,
                    requires_spellcast=current_magic or parsed["trait_raw"] == "Spellcast",
                )
            else:
                if current_row:
                    if looks_like_name_fragment(line):
                        flush_row()
                        name_parts = [line]
                    else:
                        current_row["featureText"] = (current_row["featureText"] + " " + line).strip()
                        current_row["sheetModifiers"] = parse_modifiers(current_row["featureText"])
                else:
                    if line not in HEADER_PHRASES:
                        name_parts.append(line)

        flush_row()
    return weapons


def extract_armor(reader):
    pages = extract_lines(reader, 54, 55)
    armor = []
    current_tier = None
    name_parts = []
    current_row = None

    def flush_row():
        nonlocal current_row
        if current_row:
            armor.append(current_row)
            current_row = None

    for page_num, lines in pages:
        for line in lines:
            if not line or line in SPECIAL_SKIP:
                continue
            if line.isdigit():
                continue
            if line in HEADER_PHRASES:
                flush_row()
                name_parts = []
                continue
            if line.startswith("TIER "):
                m = re.match(r"TIER\s+(\d+)", line)
                if m:
                    current_tier = int(m.group(1))
                flush_row()
                name_parts = []
                continue
            parsed = parse_armor_line(line)
            if parsed:
                flush_row()
                name = " ".join([part for part in name_parts if part] + [parsed["name_part"]]).strip()
                name_parts = []
                current_row = armor_entry_from_row(
                    {
                        "name": name,
                        "major": parsed["major"],
                        "severe": parsed["severe"],
                        "score": parsed["score"],
                        "feature": parsed["feature"],
                    },
                    tier=current_tier or 1,
                    source_page=page_num,
                )
            else:
                if current_row:
                    if looks_like_name_fragment(line):
                        flush_row()
                        name_parts = [line]
                    else:
                        current_row["featureText"] = (current_row["featureText"] + " " + line).strip()
                        current_row["sheetModifiers"] = parse_modifiers(current_row["featureText"])
                else:
                    name_parts.append(line)
        flush_row()
    return armor


def extract_loot_and_consumables(reader):
    pages = extract_lines(reader, 56, 60)
    loot_lines = []
    consumable_lines = []
    in_loot = False
    in_consumables = False
    for _, lines in pages:
        for line in lines:
            if line in SPECIAL_SKIP:
                continue
            if line == "LOOT":
                in_loot = True
                in_consumables = False
                continue
            if line == "Consumables":
                in_consumables = True
                in_loot = False
                continue
            if line.startswith("GOLD"):
                in_consumables = False
                in_loot = False
            if in_loot:
                loot_lines.append(line)
            if in_consumables:
                consumable_lines.append(line)

    loot_entries = parse_loot_entries(loot_lines)
    consumable_entries = parse_loot_entries(consumable_lines)

    items = build_items_from_entries(loot_entries, source_page=56)
    consumables = build_consumables_from_entries(consumable_entries, source_page=58)

    return items, consumables


def main():
    reader = PdfReader(str(PDF_PATH))
    weapons = extract_weapons(reader)
    armor = extract_armor(reader)
    items, consumables = extract_loot_and_consumables(reader)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "weapons.json").write_text(json.dumps(weapons, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "armor.json").write_text(json.dumps(armor, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "items.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "consumables.json").write_text(json.dumps(consumables, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Weapons:", len(weapons))
    print("Armor:", len(armor))
    print("Items:", len(items))
    print("Consumables:", len(consumables))


if __name__ == "__main__":
    main()
