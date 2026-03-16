import { z } from "zod";

export const ADVERSARY_TYPES = [
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
] as const;

const experienceSchema = z.object({
  phrase: z.string().min(1),
  value: z.string().optional(),
});

const featureSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
});

export const adversaryInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  tier: z.number().int().min(1).max(4),
  type: z.enum(ADVERSARY_TYPES),
  motives: z.string().optional(),
  difficulty: z.number().int().optional(),
  majorThreshold: z.string().optional(),
  severeThreshold: z.string().optional(),
  hp: z.string().optional(),
  stress: z.string().optional(),
  atk: z.string().optional(),
  damageAverage: z.string().optional(),
  potentialDicePools: z.array(z.string()).optional(),
  features: z.array(featureSchema).optional(),
  experiences: z.array(experienceSchema).optional(),
  weaponName: z.string().optional(),
  weaponRange: z.string().optional(),
  damageDice: z.string().optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  campaignId: z.number().int().optional(),
  narrativeFunction: z.string().optional(),
});

export const adversaryUpdateSchema = adversaryInputSchema.partial();

export type AdversaryInput = z.infer<typeof adversaryInputSchema>;
export type AdversaryUpdateInput = z.infer<typeof adversaryUpdateSchema>;

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nullIfEmpty(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

export function normalizeAdversaryPayload(input: AdversaryInput | AdversaryUpdateInput) {
  const tags = "tags" in input ? parseJsonArray(input.tags) : undefined;
  const features = "features" in input ? parseJsonArray(input.features) : undefined;
  const experiences = "experiences" in input ? parseJsonArray(input.experiences) : undefined;
  const pools =
    "potentialDicePools" in input ? parseJsonArray(input.potentialDicePools) : undefined;

  return {
    ...input,
    name: "name" in input && typeof input.name === "string" ? input.name.trim() : input.name,
    description: nullIfEmpty(input.description),
    motives: nullIfEmpty(input.motives),
    major_threshold: nullIfEmpty(input.majorThreshold),
    severe_threshold: nullIfEmpty(input.severeThreshold),
    hp: nullIfEmpty(input.hp),
    stress: nullIfEmpty(input.stress),
    atk: nullIfEmpty(input.atk),
    damage_average: nullIfEmpty(input.damageAverage),
    weapon_name: nullIfEmpty(input.weaponName),
    weapon_range: nullIfEmpty(input.weaponRange),
    damage_dice: nullIfEmpty(input.damageDice),
    image_url: nullIfEmpty(input.imageUrl),
    campaign_id: input.campaignId ?? null,
    narrative_function: nullIfEmpty(input.narrativeFunction),
    is_public: input.isPublic ?? false,
    potential_dice_pools:
      pools !== undefined ? (pools.length ? JSON.stringify(pools) : null) : undefined,
    features:
      features !== undefined ? (features.length ? JSON.stringify(features) : null) : undefined,
    experiences:
      experiences !== undefined
        ? experiences.length
          ? JSON.stringify(experiences)
          : null
        : undefined,
    tags: tags !== undefined ? (tags.length ? JSON.stringify(tags) : null) : undefined,
    majorThreshold: undefined,
    severeThreshold: undefined,
    damageAverage: undefined,
    weaponName: undefined,
    weaponRange: undefined,
    damageDice: undefined,
    imageUrl: undefined,
    potentialDicePools: undefined,
    campaignId: undefined,
    narrativeFunction: undefined,
    isPublic: undefined,
  };
}

export function mapAdversaryRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    tier: row.tier,
    type: row.type,
    motives: row.motives,
    difficulty: row.difficulty,
    majorThreshold: row.major_threshold,
    severeThreshold: row.severe_threshold,
    hp: row.hp,
    stress: row.stress,
    atk: row.atk,
    damageAverage: row.damage_average,
    potentialDicePools: parseJsonArray(row.potential_dice_pools),
    features: parseJsonArray(row.features),
    experiences: parseJsonArray(row.experiences),
    weaponName: row.weapon_name,
    weaponRange: row.weapon_range,
    damageDice: row.damage_dice,
    imageUrl: row.image_url,
    tags: parseJsonArray(row.tags),
    isHomebrew: row.is_homebrew,
    isPublic: row.is_public,
    narrativeFunction: row.narrative_function,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
