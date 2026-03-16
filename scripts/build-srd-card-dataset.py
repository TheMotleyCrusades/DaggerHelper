from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import fitz


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_OFFICIAL_PDF = REPO_ROOT / "references" / "Daggerheart-SRD-9-09-25.pdf"
DEFAULT_IMAGE_MANIFEST = REPO_ROOT / "public" / "cards" / "srd" / "manifest.json"
DEFAULT_OUTPUT_JSON = REPO_ROOT / "src" / "lib" / "data" / "srd-cards.json"
OFFICIAL_PDF_URL = "https://www.daggerheart.com/wp-content/uploads/2025/09/Daggerheart-SRD-9-09-25.pdf"

DOMAIN_ORDER = [
    "Arcana",
    "Blade",
    "Bone",
    "Codex",
    "Grace",
    "Midnight",
    "Sage",
    "Splendor",
    "Valor",
]

SUBCLASS_ORDER = [
    ("Bard", ["Troubadour", "Wordsmith"]),
    ("Druid", ["Warden of the Elements", "Warden of Renewal"]),
    ("Guardian", ["Stalwart", "Vengeance"]),
    ("Ranger", ["Beastbound", "Wayfinder"]),
    ("Rogue", ["Nightwalker", "Syndicate"]),
    ("Seraph", ["Divine Wielder", "Winged Sentinel"]),
    ("Sorcerer", ["Elemental Origin", "Primal Origin"]),
    ("Warrior", ["Call of the Brave", "Call of the Slayer"]),
    ("Wizard", ["School of Knowledge", "School of War"]),
]

COMMUNITY_ORDER = [
    "Highborne",
    "Loreborne",
    "Orderborne",
    "Ridgeborne",
    "Seaborne",
    "Slyborne",
    "Underborne",
    "Wanderborne",
    "Wildborne",
]

ANCESTRY_ORDER = [
    "Clank",
    "Drakona",
    "Dwarf",
    "Elf",
    "Faerie",
    "Faun",
    "Firbolg",
    "Fungril",
    "Galapa",
    "Giant",
    "Goblin",
    "Halfling",
    "Human",
    "Infernis",
    "Katari",
    "Orc",
    "Ribbet",
    "Simiah",
]

SMALL_WORDS = {"a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a structured SRD card dataset from the official PDF.")
    parser.add_argument(
        "--official-pdf",
        type=Path,
        default=DEFAULT_OFFICIAL_PDF,
        help=f"Local path for the official SRD PDF. Defaults to {DEFAULT_OFFICIAL_PDF}",
    )
    parser.add_argument(
        "--image-manifest",
        type=Path,
        default=DEFAULT_IMAGE_MANIFEST,
        help=f"Path to the exported card image manifest. Defaults to {DEFAULT_IMAGE_MANIFEST}",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        default=DEFAULT_OUTPUT_JSON,
        help=f"Output path for the generated dataset JSON. Defaults to {DEFAULT_OUTPUT_JSON}",
    )
    return parser.parse_args()


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    replacements = {
        "’": "'",
        "“": '"',
        "”": '"',
        "–": "-",
        "—": "-",
        "\u00a0": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)

    text = re.sub(r"\b\d+\s+\d+\s+Daggerheart SRD(?:\s+Daggerheart SRD)?\b", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def to_title_case(value: str) -> str:
    words = value.lower().split()
    result: list[str] = []
    for index, word in enumerate(words):
        parts = word.split("-")
        titled_parts = [part.capitalize() for part in parts]
        titled_word = "-".join(titled_parts)
        if 0 < index < len(words) - 1 and word in SMALL_WORDS:
            titled_word = word
        result.append(titled_word)

    return " ".join(result)


def slugify(value: str) -> str:
    slug = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = slug.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def first_sentence(text: str) -> str:
    match = re.search(r"^.*?[.!?](?:\s|$)", text)
    return match.group(0).strip() if match else text.strip()


def extract_text(document: fitz.Document, start_page: int, end_page: int) -> str:
    pages = [document.load_page(page_index).get_text("text") for page_index in range(start_page, end_page + 1)]
    return normalize_text("\n".join(pages))


def ensure_official_pdf(path: Path) -> Path:
    path = path.resolve()
    if path.exists():
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    request = Request(OFFICIAL_PDF_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request) as response:
        path.write_bytes(response.read())

    return path


def slice_by_names(text: str, names: list[str], stop_name: str | None = None) -> dict[str, str]:
    upper_names = [name.upper() for name in names]
    start_positions = {name: text.index(name.upper()) for name in names}
    ordered = sorted(((position, name) for name, position in start_positions.items()), key=lambda item: item[0])
    stop_position = text.index(stop_name.upper()) if stop_name else len(text)

    sections: dict[str, str] = {}
    for index, (position, name) in enumerate(ordered):
        end = ordered[index + 1][0] if index + 1 < len(ordered) else stop_position
        sections[name] = text[position:end].strip()

    return sections


def parse_domain_cards(document: fitz.Document) -> list[dict[str, object]]:
    text = extract_text(document, 59, 67)
    start = text.lower().find("domain card reference")
    if start < 0:
        raise ValueError("Could not locate the domain card reference in the official SRD PDF.")

    text = text[start:]
    header_pattern = re.compile(
        r"(?P<title>[A-Z0-9][A-Z0-9'\-&,!? ]+?) Level "
        r"(?P<level>\d+) "
        r"(?P<domain>Arcana|Blade|Bone|Codex|Grace|Midnight|Sage|Splendor|Valor) "
        r"(?P<card_type>Ability|Spell|Grimoire) Recall Cost: "
        r"(?P<stress_cost>\d+)"
    )

    matches = list(header_pattern.finditer(text))
    if len(matches) != 189:
        raise ValueError(f"Expected 189 domain cards, found {len(matches)}.")

    grouped: dict[tuple[int, str], list[dict[str, object]]] = {}

    for index, match in enumerate(matches):
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        raw_title = re.sub(
            r"^(?:ARCANA|BLADE|BONE|CODEX|GRACE|MIDNIGHT|SAGE|SPLENDOR|VALOR) DOMAIN ",
            "",
            match.group("title"),
        )
        title = to_title_case(raw_title)
        description = text[match.end() : next_start].strip()

        card = {
            "id": f"domain-{slugify(match.group('domain'))}-{slugify(title)}",
            "slug": f"domain-{slugify(match.group('domain'))}-{slugify(title)}",
            "title": title,
            "category": "domain",
            "type": match.group("card_type").lower(),
            "description": description,
            "domain": match.group("domain"),
            "level": int(match.group("level")),
            "stressCost": int(match.group("stress_cost")),
            "officialSource": {
                "source": "Daggerheart SRD 9-09-25",
                "sourceUrl": OFFICIAL_PDF_URL,
            },
        }

        grouped.setdefault((card["level"], card["domain"]), []).append(card)

    ordered_cards: list[dict[str, object]] = []
    for level in range(1, 11):
        for domain in DOMAIN_ORDER:
            ordered_cards.extend(grouped[(level, domain)])

    return ordered_cards


def extract_segment(text: str, start_labels: list[str], end_labels: list[str]) -> str:
    start_positions = [(text.find(label), label) for label in start_labels if text.find(label) >= 0]
    if not start_positions:
        return ""

    start_position, label = min(start_positions, key=lambda item: item[0])
    segment_start = start_position + len(label)

    end_candidates = [text.find(label, segment_start) for label in end_labels if text.find(label, segment_start) >= 0]
    segment_end = min(end_candidates) if end_candidates else len(text)
    return text[segment_start:segment_end].strip()


def parse_subclass_cards(document: fitz.Document) -> list[dict[str, object]]:
    text = extract_text(document, 4, 12)
    class_boundaries = [f"{class_name.upper()} SUBCLASSES" for class_name, _ in SUBCLASS_ORDER]

    subclass_cards: dict[tuple[str, str, str], dict[str, object]] = {}
    for class_index, (class_name, subclass_names) in enumerate(SUBCLASS_ORDER):
        class_header = class_boundaries[class_index]
        class_start = text.index(class_header)
        class_end = text.index(class_boundaries[class_index + 1]) if class_index + 1 < len(class_boundaries) else len(text)
        class_text = text[class_start:class_end].strip()

        for subclass_index, subclass_name in enumerate(subclass_names):
            subclass_start = class_text.index(subclass_name.upper())
            if subclass_index + 1 < len(subclass_names):
                subclass_end = class_text.index(subclass_names[subclass_index + 1].upper())
            else:
                next_background = class_text.find("BACKGROUND QUESTIONS", subclass_start)
                subclass_end = next_background if next_background >= 0 else len(class_text)

            subsection = class_text[subclass_start:subclass_end].strip()
            summary_match = re.search(
                rf"{re.escape(subclass_name.upper())} Play the .*? if you want (?P<summary>.+?)\.(?: SPELLCAST TRAIT| FOUNDATION FEATURE)",
                subsection,
            )
            trait_match = re.search(r"SPELLCAST TRAIT (?P<trait>[A-Za-z]+)", subsection)
            foundation_text = extract_segment(
                subsection,
                ["FOUNDATION FEATURES", "FOUNDATION FEATURE"],
                ["SPECIALIZATION FEATURES", "SPECIALIZATION FEATURE"],
            )
            specialization_text = extract_segment(
                subsection,
                ["SPECIALIZATION FEATURES", "SPECIALIZATION FEATURE"],
                ["MASTERY FEATURES", "MASTERY FEATURE"],
            )
            mastery_text = extract_segment(
                subsection,
                ["MASTERY FEATURES", "MASTERY FEATURE"],
                ["BACKGROUND QUESTIONS"],
            )

            for tier_name, feature_text in (
                ("foundation", foundation_text),
                ("specialization", specialization_text),
                ("mastery", mastery_text),
            ):
                description_parts = []
                if trait_match:
                    description_parts.append(f"Spellcast Trait: {trait_match.group('trait')}")
                description_parts.append(feature_text)
                slug = f"subclass-{slugify(class_name)}-{slugify(subclass_name)}-{tier_name}"

                subclass_cards[(class_name, subclass_name, tier_name)] = {
                    "id": slug,
                    "slug": slug,
                    "title": subclass_name,
                    "category": "subclass",
                    "type": tier_name,
                    "description": "\n".join(part for part in description_parts if part),
                    "className": class_name,
                    "subclassName": subclass_name,
                    "tier": tier_name,
                    "summary": summary_match.group("summary") if summary_match else None,
                    "spellcastTrait": trait_match.group("trait") if trait_match else None,
                    "officialSource": {
                        "source": "Daggerheart SRD 9-09-25",
                        "sourceUrl": OFFICIAL_PDF_URL,
                    },
                }

    ordered_cards: list[dict[str, object]] = []
    for tier_name in ("foundation", "specialization", "mastery"):
        for class_name, subclass_names in SUBCLASS_ORDER:
            for subclass_name in subclass_names:
                ordered_cards.append(subclass_cards[(class_name, subclass_name, tier_name)])

    if len(ordered_cards) != 54:
        raise ValueError(f"Expected 54 subclass cards, found {len(ordered_cards)}.")

    return ordered_cards


def parse_community_cards(document: fitz.Document) -> list[dict[str, object]]:
    text = extract_text(document, 16, 17)
    sections = slice_by_names(text, COMMUNITY_ORDER)
    cards: list[dict[str, object]] = []

    for community_name in COMMUNITY_ORDER:
        section = sections[community_name]
        body = section[len(community_name) :].strip()
        intro = first_sentence(body)
        feature_match = re.search(r"COMMUNITY FEATURE (?P<feature>.+)", section)
        adjectives_match = re.search(rf"{re.escape(community_name)} are often (?P<traits>.+?)\. COMMUNITY FEATURE", section)
        feature_text = feature_match.group("feature").strip() if feature_match else ""

        cards.append(
            {
                "id": f"community-{slugify(community_name)}",
                "slug": f"community-{slugify(community_name)}",
                "title": community_name,
                "category": "community",
                "type": "community",
                "description": "\n".join(part for part in (intro, feature_text) if part),
                "communityName": community_name,
                "personalityWords": [word.strip() for word in adjectives_match.group("traits").split(",")] if adjectives_match else [],
                "officialSource": {
                    "source": "Daggerheart SRD 9-09-25",
                    "sourceUrl": OFFICIAL_PDF_URL,
                },
            }
        )

    if len(cards) != 9:
        raise ValueError(f"Expected 9 community cards, found {len(cards)}.")

    return cards


def parse_ancestry_cards(document: fitz.Document) -> list[dict[str, object]]:
    text = extract_text(document, 13, 15)
    sections = slice_by_names(text, ANCESTRY_ORDER, stop_name="MIXED ANCESTRY")
    cards: list[dict[str, object]] = []

    for ancestry_name in ANCESTRY_ORDER:
        section = sections[ancestry_name]
        body = section[len(ancestry_name) :].strip()
        intro = first_sentence(body)
        feature_text = extract_segment(section, ["ANCESTRY FEATURES", "ANCESTRY FEATURE"], [])

        cards.append(
            {
                "id": f"ancestry-{slugify(ancestry_name)}",
                "slug": f"ancestry-{slugify(ancestry_name)}",
                "title": ancestry_name,
                "category": "ancestry",
                "type": "ancestry",
                "description": "\n".join(part for part in (intro, feature_text) if part),
                "ancestryName": ancestry_name,
                "officialSource": {
                    "source": "Daggerheart SRD 9-09-25",
                    "sourceUrl": OFFICIAL_PDF_URL,
                },
            }
        )

    if len(cards) != 18:
        raise ValueError(f"Expected 18 ancestry cards, found {len(cards)}.")

    return cards


def attach_images(cards: list[dict[str, object]], manifest_path: Path) -> list[dict[str, object]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    image_cards = manifest["cards"]
    if len(image_cards) != len(cards):
        raise ValueError(f"Expected {len(cards)} image records, found {len(image_cards)}.")

    attached_cards: list[dict[str, object]] = []
    for index, card in enumerate(cards):
        image = image_cards[index]
        next_card = {
            **card,
            "sequence": index + 1,
            "asset": {
                "filename": image["filename"],
                "publicPath": image["publicPath"],
                "page": image["page"],
                "row": image["row"],
                "column": image["column"],
                "width": image["width"],
                "height": image["height"],
            },
        }
        attached_cards.append(next_card)

    return attached_cards


def build_dataset(document: fitz.Document, manifest_path: Path) -> dict[str, object]:
    domain_cards = parse_domain_cards(document)
    subclass_cards = parse_subclass_cards(document)
    community_cards = parse_community_cards(document)
    ancestry_cards = parse_ancestry_cards(document)

    cards = attach_images(domain_cards + subclass_cards + community_cards + ancestry_cards, manifest_path)
    counts = {
        "total": len(cards),
        "domain": len(domain_cards),
        "subclass": len(subclass_cards),
        "community": len(community_cards),
        "ancestry": len(ancestry_cards),
    }

    return {
        "version": "2025-09-09",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "officialPdfUrl": OFFICIAL_PDF_URL,
            "imageManifest": str(manifest_path),
        },
        "counts": counts,
        "cards": cards,
    }


def main() -> None:
    args = parse_args()
    official_pdf_path = ensure_official_pdf(args.official_pdf)
    image_manifest_path = args.image_manifest.expanduser().resolve()
    output_json_path = args.output_json.expanduser().resolve()

    if not image_manifest_path.exists():
        raise SystemExit(f"Card image manifest not found: {image_manifest_path}")

    output_json_path.parent.mkdir(parents=True, exist_ok=True)

    document = fitz.open(official_pdf_path)
    dataset = build_dataset(document, image_manifest_path)
    output_json_path.write_text(json.dumps(dataset, indent=2), encoding="utf-8")

    print(f"Wrote {dataset['counts']['total']} SRD card records to {output_json_path}")


if __name__ == "__main__":
    main()
