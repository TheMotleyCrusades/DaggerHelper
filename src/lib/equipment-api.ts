import { supabaseAdmin } from "@/lib/supabase/admin";

export function parsePositiveInt(value: string | null, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
}

export function normalizeSearch(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function tableMissingError(error: { message?: string; details?: string } | null) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("could not find the table");
}

export async function fetchAllRows(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select("*");
  if (error) {
    if (tableMissingError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function fetchRowById(table: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (tableMissingError(error)) return null;
    throw new Error(error.message);
  }

  return (data as Record<string, unknown> | null) ?? null;
}

export async function getAccessibleCampaign(campaignId: number, userId: number) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(campaignError.message);
  }
  if (!campaign) return null;

  if (campaign.user_id === userId) {
    return {
      ...campaign,
      isOwner: true,
    };
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) return null;
  return {
    ...campaign,
    isOwner: false,
  };
}

export async function requireCampaignOwner(campaignId: number, userId: number) {
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return campaign ? { id: Number(campaign.id), userId: Number(campaign.user_id) } : null;
}

export async function hasInventoryReference(entityKind: "weapon" | "armor" | "item" | "consumable", entityId: string) {
  const { data, error } = await supabaseAdmin
    .from("character_inventory_entries")
    .select("id")
    .eq("entity_kind", entityKind)
    .eq("entity_id", entityId)
    .limit(1);

  if (error) {
    if (tableMissingError(error)) return false;
    throw new Error(error.message);
  }

  return (data ?? []).length > 0;
}

