import fs from "node:fs";
import path from "node:path";

const GUIDE_PATH = path.resolve("..", "NEXTJS_SUPABASE_BUILD_GUIDE.md");
const SOURCE_FILES = [
  "C:/Users/Rowan/Documents/Downloads/Daggerheart Adversaries Tier 1.txt",
  "C:/Users/Rowan/Documents/Downloads/Daggerheart Adversaries Tier 2.txt",
  "C:/Users/Rowan/Documents/Downloads/Daggerheart Adversaries Tier 3.txt",
  "C:/Users/Rowan/Documents/Downloads/Daggerheart Adversaries Tier 4.txt",
];

const EXPECTED_COUNT = 129;
const DRY_RUN = process.argv.includes("--dry-run");

const TYPE_ORDER = [
  "bruiser",
  "horde",
  "leader",
  "minion",
  "ranged",
  "skulk",
  "solo",
  "standard",
  "support",
  "colossal",
  "social",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readFileOrFail(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function extractEnvValue(text, key) {
  const match = text.match(new RegExp(`${key}=([^\\r\\n]+)`));
  return match?.[1]?.trim() ?? null;
}

function normalizeLine(line) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"');
}

function isTierHeading(line) {
  return /^Tier\s+[1-4]\s+Adversaries\b/i.test(line);
}

function isTierLine(line) {
  return /^Tier\s+[1-4]\s+.+/i.test(line) && !isTierHeading(line);
}

function isTopLabel(line) {
  return (
    line.startsWith("Motives & Tactics:") ||
    line.startsWith("Difficulty:") ||
    line.startsWith("ATK:") ||
    line.startsWith("Experience:") ||
    line === "Features" ||
    isTierLine(line)
  );
}

function splitThresholds(value) {
  const cleaned = value.trim();
  if (/^none$/i.test(cleaned)) return { major: null, severe: null };

  const match = cleaned.match(/(-?\d+)\s*\/\s*(-?\d+)/);
  if (!match) return { major: null, severe: null };
  return {
    major: Number.parseInt(match[1], 10),
    severe: Number.parseInt(match[2], 10),
  };
}

function parseStats(line) {
  const match = line.match(
    /^Difficulty:\s*([^|]+)\|\s*Thresholds:\s*([^|]+)\|\s*HP:\s*([^|]+)\|\s*Stress:\s*(.+)$/i
  );
  if (!match) {
    return {
      difficulty: null,
      majorThreshold: null,
      severeThreshold: null,
      hp: null,
      stress: null,
    };
  }

  const difficulty = Number.parseInt(match[1].trim(), 10);
  const thresholds = splitThresholds(match[2]);
  return {
    difficulty: Number.isNaN(difficulty) ? null : difficulty,
    majorThreshold: thresholds.major,
    severeThreshold: thresholds.severe,
    hp: match[3].trim() || null,
    stress: match[4].trim() || null,
  };
}

function parseAttack(lines, startIndex) {
  let index = startIndex;
  let combined = lines[index];

  while (index + 1 < lines.length && !isTopLabel(lines[index + 1])) {
    const pipeCount = (combined.match(/\|/g) ?? []).length;
    if (pipeCount >= 2) break;
    index += 1;
    combined = `${combined} ${lines[index]}`;
  }

  const parsed = {
    consumedIndex: index,
    atk: null,
    weaponName: null,
    weaponRange: null,
    damageDice: null,
  };

  const match = combined.match(/^ATK:\s*([^|]+)\|\s*([^:|]+):\s*([^|]+)\|\s*(.+)$/i);
  if (!match) return parsed;

  parsed.atk = match[1].trim();
  parsed.weaponName = match[2].trim();
  parsed.weaponRange = match[3].trim();

  const damageRaw = match[4].trim();
  parsed.damageDice = damageRaw.replace(/\s+(phy|mag)$/i, "").trim();

  return parsed;
}

function parseExperiences(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)(?:\s+([+-]?\d+))$/);
      if (!match) {
        return { phrase: part };
      }
      const phrase = match[1].trim();
      const numeric = Number.parseInt(match[2], 10);
      const valueString =
        Number.isNaN(numeric) || match[2].startsWith("+") || match[2].startsWith("-")
          ? match[2]
          : `+${match[2]}`;
      return {
        phrase: phrase || part,
        value: valueString,
      };
    });
}

function parseFeatureStart(line) {
  const match = line.match(/^(.+?)\s*-\s*(Passive|Action|Reaction)\s*:\s*(.*)$/i);
  if (!match) return null;
  return {
    name: match[1].trim(),
    type: match[2].toLowerCase(),
    description: match[3].trim(),
  };
}

function normalizeType(roleRaw) {
  const lower = roleRaw.toLowerCase();
  for (const type of TYPE_ORDER) {
    if (lower.includes(type)) return type;
  }
  return "standard";
}

function parseEntry(name, tierLine, bodyLines) {
  const tierMatch = tierLine.match(/^Tier\s+([1-4])\s+(.+)$/i);
  if (!tierMatch) return null;

  const tier = Number.parseInt(tierMatch[1], 10);
  const roleRaw = tierMatch[2].trim();
  const type = normalizeType(roleRaw);

  let description = null;
  let motives = null;
  let difficulty = null;
  let majorThreshold = null;
  let severeThreshold = null;
  let hp = null;
  let stress = null;
  let atk = null;
  let weaponName = null;
  let weaponRange = null;
  let damageDice = null;
  let experienceLine = null;
  const features = [];

  let inFeatures = false;
  let currentFeature = null;

  for (let i = 0; i < bodyLines.length; i += 1) {
    const line = bodyLines[i];
    if (!line) continue;

    if (line === "Features") {
      inFeatures = true;
      continue;
    }

    if (!inFeatures) {
      if (!description && !isTopLabel(line)) {
        description = line;
        continue;
      }

      if (line.startsWith("Motives & Tactics:")) {
        motives = line.replace(/^Motives & Tactics:\s*/i, "").trim() || null;
        continue;
      }

      if (line.startsWith("Difficulty:")) {
        const stats = parseStats(line);
        difficulty = stats.difficulty;
        majorThreshold = stats.majorThreshold;
        severeThreshold = stats.severeThreshold;
        hp = stats.hp;
        stress = stats.stress;
        continue;
      }

      if (line.startsWith("ATK:")) {
        const attack = parseAttack(bodyLines, i);
        i = attack.consumedIndex;
        atk = attack.atk;
        weaponName = attack.weaponName;
        weaponRange = attack.weaponRange;
        damageDice = attack.damageDice;
        continue;
      }

      if (line.startsWith("Experience:")) {
        let combined = line.replace(/^Experience:\s*/i, "").trim();
        while (i + 1 < bodyLines.length && !isTopLabel(bodyLines[i + 1])) {
          i += 1;
          combined = `${combined} ${bodyLines[i]}`.trim();
        }
        experienceLine = combined || null;
      }

      continue;
    }

    const featureStart = parseFeatureStart(line);
    if (featureStart) {
      if (currentFeature) features.push(currentFeature);
      currentFeature = featureStart;
      continue;
    }

    if (!currentFeature) continue;
    currentFeature.description = `${currentFeature.description} ${line}`.trim();
  }

  if (currentFeature) features.push(currentFeature);

  const experiences = experienceLine ? parseExperiences(experienceLine) : [];
  const cleanedName = name.trim();

  if (!cleanedName || !description || !Number.isFinite(tier)) return null;

  return {
    sourceRole: roleRaw,
    name: cleanedName,
    description,
    tier,
    type,
    motives,
    difficulty,
    majorThreshold,
    severeThreshold,
    hp,
    stress,
    atk,
    weaponName,
    weaponRange,
    damageDice,
    experiences,
    features,
  };
}

function parseSourceFile(filePath) {
  const text = normalizeText(readFileOrFail(filePath));
  const lines = text
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  const tierIndexes = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isTierLine(lines[i])) tierIndexes.push(i);
  }

  const entries = [];
  for (let i = 0; i < tierIndexes.length; i += 1) {
    const tierIndex = tierIndexes[i];
    const nextTierIndex = i + 1 < tierIndexes.length ? tierIndexes[i + 1] : lines.length;
    const name = tierIndex > 0 ? lines[tierIndex - 1] : "";

    if (!name || isTierHeading(name) || isTierLine(name)) continue;

    const tierLine = lines[tierIndex];
    const bodyLines = lines.slice(tierIndex + 1, nextTierIndex);
    const parsed = parseEntry(name, tierLine, bodyLines);
    if (parsed) entries.push(parsed);
  }

  return entries;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function restRequest({ baseUrl, apiKey, method, endpoint, query = "", body = null, headers = {} }) {
  const url = `${baseUrl}/rest/v1/${endpoint}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `${method} ${endpoint}${query ? `?${query}` : ""} failed (${response.status}): ${
        typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500)
      }`
    );
  }

  return { data, headers: response.headers };
}

async function getExactCount(baseUrl, apiKey, table, filter = "") {
  const query = `select=id${filter ? `&${filter}` : ""}`;
  const { headers } = await restRequest({
    baseUrl,
    apiKey,
    method: "GET",
    endpoint: table,
    query,
    headers: { Prefer: "count=exact" },
  });
  const contentRange = headers.get("content-range") || "*/0";
  return Number.parseInt(contentRange.split("/")[1] ?? "0", 10);
}

async function getUserIds(baseUrl, apiKey) {
  const { data } = await restRequest({
    baseUrl,
    apiKey,
    method: "GET",
    endpoint: "users",
    query: "select=id&order=id.asc",
  });

  return Array.isArray(data) ? data.map((item) => item.id).filter((id) => Number.isInteger(id)) : [];
}

function toRows(entries, fallbackUserId) {
  const now = new Date().toISOString();
  return entries.map((entry, index) => {
    const tags = ["official", "srd", `tier-${entry.tier}`, entry.type];
    const uniqueTags = [...new Set(tags)];
    const pools = entry.damageDice ? [entry.damageDice] : [];

    return {
      id: 800000 + index + 1,
      user_id: fallbackUserId,
      campaign_id: null,
      name: entry.name,
      description: entry.description,
      tier: entry.tier,
      type: entry.type,
      motives: entry.motives ?? null,
      difficulty: entry.difficulty ?? null,
      major_threshold: entry.majorThreshold,
      severe_threshold: entry.severeThreshold,
      hp: entry.hp ?? null,
      stress: entry.stress ?? null,
      atk: entry.atk ?? null,
      damage_average: null,
      potential_dice_pools: pools.length ? JSON.stringify(pools) : null,
      features: entry.features.length ? JSON.stringify(entry.features) : null,
      experiences: entry.experiences.length ? JSON.stringify(entry.experiences) : null,
      weapon_name: entry.weaponName ?? null,
      weapon_range: entry.weaponRange ?? null,
      damage_dice: entry.damageDice ?? null,
      image_url: null,
      image_asset_id: null,
      tags: JSON.stringify(uniqueTags),
      is_homebrew: false,
      is_public: true,
      narrative_function: null,
      created_at: now,
      updated_at: now,
    };
  });
}

async function main() {
  const guide = readFileOrFail(GUIDE_PATH);
  const supabaseUrl = extractEnvValue(guide, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = extractEnvValue(guide, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    fail("Could not read Supabase credentials from guide.");
  }

  const parsedEntries = SOURCE_FILES.flatMap((file) => parseSourceFile(file));
  const deduped = [];
  const seen = new Set();
  for (const entry of parsedEntries) {
    const key = `${entry.tier}|${entry.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  if (deduped.length !== EXPECTED_COUNT) {
    fail(`Parsed ${deduped.length} adversaries from source files, expected ${EXPECTED_COUNT}.`);
  }

  const userIds = await getUserIds(supabaseUrl, serviceRoleKey);
  if (!userIds.length) {
    fail("No users found in runtime schema; cannot assign user_id on adversary records.");
  }
  const fallbackUserId = userIds.includes(2) ? 2 : userIds[0];
  const rows = toRows(deduped, fallbackUserId);

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          status: "dry-run",
          parsed: deduped.length,
          fallbackUserId,
          sample: rows.slice(0, 3).map((row) => ({
            id: row.id,
            name: row.name,
            tier: row.tier,
            type: row.type,
            difficulty: row.difficulty,
            weapon_name: row.weapon_name,
            damage_dice: row.damage_dice,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  await restRequest({
    baseUrl: supabaseUrl,
    apiKey: serviceRoleKey,
    method: "DELETE",
    endpoint: "adversaries",
    query: "is_homebrew=eq.false",
  });

  for (const group of chunk(rows, 40)) {
    await restRequest({
      baseUrl: supabaseUrl,
      apiKey: serviceRoleKey,
      method: "POST",
      endpoint: "adversaries",
      query: "on_conflict=id",
      body: group,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  }

  const officialCount = await getExactCount(
    supabaseUrl,
    serviceRoleKey,
    "adversaries",
    "is_homebrew=eq.false"
  );
  const publicCount = await getExactCount(
    supabaseUrl,
    serviceRoleKey,
    "adversaries",
    "is_homebrew=eq.false&is_public=eq.true"
  );
  const totalCount = await getExactCount(supabaseUrl, serviceRoleKey, "adversaries");

  if (officialCount < EXPECTED_COUNT) {
    fail(
      `Official adversary import incomplete. official=${officialCount}, expected=${EXPECTED_COUNT}, total=${totalCount}.`
    );
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        parsed: deduped.length,
        insertedOfficial: officialCount,
        publicOfficial: publicCount,
        totalAdversaries: totalCount,
        fallbackUserId,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
