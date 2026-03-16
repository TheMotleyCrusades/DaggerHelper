import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SCHEMA_PATH = path.resolve(ROOT, "src", "lib", "database", "schema.sql");
const ENV_FILES = [
  path.resolve(ROOT, ".env.local"),
  path.resolve(ROOT, ".env"),
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries = {};
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    const unquoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;
    entries[key] = unquoted;
  }
  return entries;
}

function collectEnv() {
  const fromFiles = {};
  for (const filePath of ENV_FILES) {
    Object.assign(fromFiles, parseEnvFile(filePath));
  }
  return { ...fromFiles, ...process.env };
}

async function verifyHudTables(baseUrl, apiKey) {
  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/openapi+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed OpenAPI check (${response.status})`);
  }

  const payload = await response.json();
  const definitions = payload?.definitions ?? {};
  const required = [
    "campaign_hud_states",
    "campaign_hud_character_overlays",
    "campaign_hud_adversary_instances",
    "character_inventory_entries",
    "weapons",
    "armor",
    "items",
    "consumables",
  ];

  const missing = required.filter((name) => !definitions[name]);
  if (missing.length > 0) {
    throw new Error(`Schema verification failed. Missing tables: ${missing.join(", ")}`);
  }
}

async function main() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    fail(`Schema file not found: ${SCHEMA_PATH}`);
  }

  const env = collectEnv();
  const databaseUrl =
    env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;

  if (!databaseUrl) {
    fail(
      "Missing database URL. Set DATABASE_URL (or SUPABASE_DB_URL/POSTGRES_URL) to run schema apply."
    );
  }

  const apply = spawnSync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", SCHEMA_PATH],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "10",
      },
    }
  );

  if (apply.status !== 0) {
    fail(`psql schema apply failed with exit code ${apply.status ?? 1}`);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRole) {
    await verifyHudTables(supabaseUrl, serviceRole);
    console.log("Schema apply complete and verified (HUD + catalog tables present).");
    return;
  }

  console.log(
    "Schema apply complete. Skipped OpenAPI table verification because NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
  );
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
