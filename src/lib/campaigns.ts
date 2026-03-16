import { randomBytes } from "node:crypto";
import { z } from "zod";
import { parseCampaignDescription } from "@/lib/campaign-metadata";

export const campaignCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

export const campaignJoinSchema = z.object({
  inviteCode: z.string().min(4).max(50),
});

export const campaignMemberRemoveSchema = z.object({
  userId: z.number().int().positive(),
});

export function generateInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function mapCampaignRow(row: Record<string, unknown>) {
  const parsed = parseCampaignDescription(row.description);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: parsed.notes || null,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCampaignMemberRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}
