import fs from "node:fs";
import path from "node:path";

const GUIDE_PATH = path.resolve("..", "NEXTJS_SUPABASE_BUILD_GUIDE.md");
const SEED_SQL_PATH = path.resolve("..", "daggerheart_data_inserts.sql");

const ADVERSARY_TARGET = 129;
const ITEM_TARGET = 40;
const STRICT_TARGETS = process.argv.includes("--strict-targets");

const ADVERSARY_SOURCE_COLUMNS = [
  "id",
  "userId",
  "campaignId",
  "name",
  "description",
  "narrativeFunction",
  "tier",
  "type",
  "difficulty",
  "majorThreshold",
  "severeThreshold",
  "hp",
  "stress",
  "atk",
  "damageAverage",
  "potentialDicePools",
  "features",
  "isHomebrew",
  "isPublic",
  "imageAssetId",
  "createdAt",
  "updatedAt",
  "experiences",
  "weaponName",
  "weaponRange",
  "damageDice",
  "imageUrl",
  "tags",
  "motives",
];

const ITEM_SOURCE_COLUMNS = [
  "id",
  "userId",
  "name",
  "description",
  "itemType",
  "tags",
  "properties",
  "isOfficial",
  "isPublic",
  "createdAt",
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

function extractEnvValue(guide, key) {
  const match = guide.match(new RegExp(`${key}=([^\\r\\n]+)`));
  return match?.[1]?.trim() ?? null;
}

function toBool(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "t" || normalized === "1") return true;
  if (normalized === "false" || normalized === "f" || normalized === "0") return false;
  return fallback;
}

function toInt(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toIntStrict(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) return fallback;
  return Number.parseInt(text, 10);
}

function parseSqlLiteral(token) {
  const trimmed = token.trim();
  if (trimmed.toUpperCase() === "NULL") return null;

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const raw = trimmed.slice(1, -1);
    let out = "";
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === "\\" && i + 1 < raw.length) {
        out += raw[i + 1];
        i += 1;
      } else {
        out += ch;
      }
    }
    return out;
  }

  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);

  return trimmed;
}

function splitTupleFields(tupleText) {
  const fields = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < tupleText.length; i += 1) {
    const ch = tupleText[i];
    const prev = i > 0 ? tupleText[i - 1] : "";

    if (ch === "'" && prev !== "\\") {
      inString = !inString;
      current += ch;
      continue;
    }

    if (ch === "," && !inString) {
      fields.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.length > 0) fields.push(current);
  return fields.map(parseSqlLiteral);
}

function parseInsertTuples(sqlText, tableName) {
  const marker = `INSERT INTO public.${tableName} VALUES `;
  const start = sqlText.indexOf(marker);
  if (start === -1) {
    fail(`Could not find seed insert for table: ${tableName}`);
  }

  const valuesStart = start + marker.length;
  const end = sqlText.indexOf(";", valuesStart);
  if (end === -1) {
    fail(`Could not find end of insert statement for table: ${tableName}`);
  }

  const valuesText = sqlText.slice(valuesStart, end);
  const tuples = [];
  let inString = false;
  let depth = 0;
  let tupleBuffer = "";

  for (let i = 0; i < valuesText.length; i += 1) {
    const ch = valuesText[i];
    const prev = i > 0 ? valuesText[i - 1] : "";

    if (ch === "'" && prev !== "\\") {
      inString = !inString;
      if (depth > 0) tupleBuffer += ch;
      continue;
    }

    if (!inString && ch === "(") {
      if (depth === 0) tupleBuffer = "";
      depth += 1;
      continue;
    }

    if (!inString && ch === ")") {
      depth -= 1;
      if (depth === 0) {
        tuples.push(splitTupleFields(tupleBuffer));
        tupleBuffer = "";
        continue;
      }
    }

    if (depth > 0) tupleBuffer += ch;
  }

  return tuples;
}

function objectFromColumns(columns, values) {
  const out = {};
  columns.forEach((col, idx) => {
    out[col] = idx < values.length ? values[idx] : null;
  });
  return out;
}

function mapAdversaryRow(rawRow, fallbackUserId) {
  const userId = toInt(rawRow.userId, fallbackUserId) ?? fallbackUserId;
  return {
    id: toInt(rawRow.id, undefined),
    user_id: userId,
    campaign_id: toInt(rawRow.campaignId, null),
    name: rawRow.name ?? "Unnamed Adversary",
    description: rawRow.description ?? null,
    tier: toInt(rawRow.tier, 1) ?? 1,
    type: rawRow.type ? String(rawRow.type) : "standard",
    motives: rawRow.motives ?? null,
    difficulty: toIntStrict(rawRow.difficulty, null),
    major_threshold: toIntStrict(rawRow.majorThreshold, null),
    severe_threshold: toIntStrict(rawRow.severeThreshold, null),
    hp: rawRow.hp ?? null,
    stress: rawRow.stress ?? null,
    atk: rawRow.atk ?? null,
    damage_average: rawRow.damageAverage ?? null,
    potential_dice_pools: rawRow.potentialDicePools ?? null,
    features: rawRow.features ?? null,
    experiences: rawRow.experiences ?? null,
    weapon_name: rawRow.weaponName ?? null,
    weapon_range: rawRow.weaponRange ?? null,
    damage_dice: rawRow.damageDice ?? null,
    image_url: rawRow.imageUrl ?? null,
    image_asset_id: toInt(rawRow.imageAssetId, null),
    tags: rawRow.tags ?? null,
    is_homebrew: toBool(rawRow.isHomebrew, true),
    is_public: toBool(rawRow.isPublic, false),
    narrative_function: rawRow.narrativeFunction ?? null,
    created_at: rawRow.createdAt ?? null,
    updated_at: rawRow.updatedAt ?? rawRow.createdAt ?? null,
  };
}

function mapTierToRarity(properties) {
  if (!properties || typeof properties !== "string") return "common";
  try {
    const parsed = JSON.parse(properties);
    const tier = toInt(parsed?.tier, 1) ?? 1;
    if (tier <= 1) return "common";
    if (tier === 2) return "uncommon";
    if (tier === 3) return "rare";
    return "legendary";
  } catch {
    return "common";
  }
}

function mapItemRow(rawRow) {
  const created = rawRow.createdAt ?? null;
  return {
    id: toInt(rawRow.id, undefined),
    user_id: toInt(rawRow.userId, null),
    name: rawRow.name ?? "Unnamed Item",
    description: rawRow.description ?? null,
    category: rawRow.itemType ?? "misc",
    rarity: mapTierToRarity(rawRow.properties),
    is_homebrew: !toBool(rawRow.isOfficial, false),
    is_public: toBool(rawRow.isPublic, false),
    created_at: created,
    updated_at: created,
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
        typeof data === "string" ? data.slice(0, 600) : JSON.stringify(data).slice(0, 600)
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

  return Array.isArray(data) ? data.map((row) => row.id).filter((id) => Number.isInteger(id)) : [];
}

async function verifyTables(baseUrl, apiKey) {
  const { data } = await restRequest({
    baseUrl,
    apiKey,
    method: "GET",
    endpoint: "",
    headers: { Accept: "application/openapi+json" },
  });

  const definitions = data?.definitions ?? {};
  const expectedTables = [
    "users",
    "adversaries",
    "adversary_favourites",
    "campaigns",
    "campaign_members",
    "characters",
    "encounters",
    "encounter_adversaries",
    "items",
    "session_notes",
  ];

  const missing = expectedTables.filter((table) => !definitions[table]);
  if (missing.length > 0) {
    fail(`Missing required runtime tables in Supabase metadata: ${missing.join(", ")}`);
  }
}

async function upsertRows(baseUrl, apiKey, table, rows) {
  let inserted = 0;
  const groups = chunk(rows, 50);
  for (const group of groups) {
    await restRequest({
      baseUrl,
      apiKey,
      method: "POST",
      endpoint: table,
      query: "on_conflict=id",
      body: group,
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    });
    inserted += group.length;
  }
  return inserted;
}

async function main() {
  const guide = readFileOrFail(GUIDE_PATH);
  const seedSql = readFileOrFail(SEED_SQL_PATH);

  const supabaseUrl = extractEnvValue(guide, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = extractEnvValue(guide, "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    fail("Could not read NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY from guide.");
  }

  await verifyTables(supabaseUrl, serviceRole);

  const userIds = await getUserIds(supabaseUrl, serviceRole);
  if (userIds.length === 0) fail("No users exist in runtime schema; cannot seed foreign-keyed tables.");
  const fallbackUserId = userIds.includes(2) ? 2 : userIds[0];

  const adversaryTuples = parseInsertTuples(seedSql, "adversaries");
  const itemTuples = parseInsertTuples(seedSql, "items");

  const adversaryRows = adversaryTuples
    .map((values) => objectFromColumns(ADVERSARY_SOURCE_COLUMNS, values))
    .map((row) => mapAdversaryRow(row, fallbackUserId))
    .filter((row) => row.name && row.tier && row.type);

  const itemRows = itemTuples
    .map((values) => objectFromColumns(ITEM_SOURCE_COLUMNS, values))
    .map(mapItemRow)
    .filter((row) => row.name);

  const officialAdversaryCount = await getExactCount(
    supabaseUrl,
    serviceRole,
    "adversaries",
    "is_homebrew=eq.false"
  );
  const skipAdversarySeed = officialAdversaryCount >= ADVERSARY_TARGET;

  if (!skipAdversarySeed) {
    await upsertRows(supabaseUrl, serviceRole, "adversaries", adversaryRows);
  }
  await upsertRows(supabaseUrl, serviceRole, "items", itemRows);

  const adversaryCount = await getExactCount(supabaseUrl, serviceRole, "adversaries");
  const officialCountAfter = await getExactCount(
    supabaseUrl,
    serviceRole,
    "adversaries",
    "is_homebrew=eq.false"
  );
  const itemCount = await getExactCount(supabaseUrl, serviceRole, "items");
  const userCount = await getExactCount(supabaseUrl, serviceRole, "users");

  const targetMet = adversaryCount >= ADVERSARY_TARGET && itemCount >= ITEM_TARGET;
  if (!targetMet && STRICT_TARGETS) {
    fail(
      `Seed incomplete. users=${userCount}, adversaries=${adversaryCount} (target ${ADVERSARY_TARGET}), items=${itemCount} (target ${ITEM_TARGET}).`
    );
  }

  if (!targetMet) {
    console.warn(
      `Warning: seed target mismatch. adversaries=${adversaryCount}/${ADVERSARY_TARGET}, items=${itemCount}/${ITEM_TARGET}.`
    );
  }

  console.log(
    JSON.stringify(
      {
        status: targetMet ? "ok" : "partial",
        users: userCount,
        adversaries: adversaryCount,
        items: itemCount,
        targets: {
          adversaries: ADVERSARY_TARGET,
          items: ITEM_TARGET,
          met: targetMet,
          strictMode: STRICT_TARGETS,
        },
        fallbackUserId,
        parsed: {
          adversaryRows: adversaryRows.length,
          itemRows: itemRows.length,
        },
        adversarySeed: {
          skipped: skipAdversarySeed,
          officialBefore: officialAdversaryCount,
          officialAfter: officialCountAfter,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
