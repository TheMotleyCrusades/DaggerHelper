import { z } from "zod";

export const ROLE_COSTS: Record<string, number> = {
  minion: 1,
  social: 1,
  support: 1,
  horde: 2,
  ranged: 2,
  skulk: 2,
  standard: 2,
  leader: 3,
  bruiser: 4,
  solo: 5,
  colossal: 5,
};

export function calculateBaseBudget(partySize: number) {
  return 3 * partySize + 2;
}

export function calculateEncounterCost(
  selections: Array<{ type: string; quantity: number }>
) {
  return selections.reduce((sum, item) => {
    const roleCost = ROLE_COSTS[item.type] ?? 2;
    return sum + roleCost * Math.max(1, item.quantity);
  }, 0);
}

export function classifyDifficulty(cost: number, budget: number) {
  if (budget <= 0) return "unknown";
  const ratio = cost / budget;
  if (ratio < 0.75) return "easy";
  if (ratio <= 1) return "moderate";
  if (ratio <= 1.25) return "hard";
  return "deadly";
}

export const encounterAdversarySchema = z.object({
  adversaryId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50).default(1),
});

export const encounterCreateSchema = z.object({
  campaignId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  partySize: z.number().int().min(1).max(10).default(4),
  difficultyAdjustment: z.number().int().min(-5).max(10).default(0),
  adversaries: z.array(encounterAdversarySchema).default([]),
});

export const encounterUpdateSchema = encounterCreateSchema.partial();

export function mapEncounterRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description,
    difficulty: row.difficulty,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
