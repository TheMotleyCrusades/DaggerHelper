import {
  normalizeCampaignMetadata,
  parseCampaignDescription,
  resolveCampaignHomebrew,
  serializeCampaignDescription,
  type CampaignHomebrewCollections,
  type CampaignMetadata,
} from "@/lib/campaign-metadata";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CampaignRow = {
  id: number;
  user_id: number;
  description: string | null;
};

type OwnedCollectionMatch<K extends keyof CampaignHomebrewCollections> = {
  campaignId: number;
  notes: string;
  metadata: CampaignMetadata;
  homebrew: CampaignHomebrewCollections;
  item: CampaignHomebrewCollections[K][number];
};

export async function getAccessibleCampaign(campaignId: number, userId: number) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id,description")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(campaignError.message);
  }
  if (!campaign) return null;

  if (campaign.user_id === userId) return campaign as CampaignRow;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  return member ? (campaign as CampaignRow) : null;
}

export async function getOwnedCampaign(campaignId: number, ownerId: number) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id,description")
    .eq("id", campaignId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as CampaignRow | null) ?? null;
}

export function parseCampaignHomebrewContext(description: unknown) {
  const parsed = parseCampaignDescription(description);
  const normalized = normalizeCampaignMetadata(parsed.metadata);
  const homebrew = resolveCampaignHomebrew(normalized);

  return {
    notes: parsed.notes,
    metadata: normalized,
    homebrew,
  };
}

export async function persistCampaignHomebrew(
  campaignId: number,
  ownerId: number,
  notes: string,
  metadata: CampaignMetadata,
  homebrew: CampaignHomebrewCollections
) {
  const description = serializeCampaignDescription(notes, {
    ...metadata,
    homebrew,
  });

  const { error } = await supabaseAdmin
    .from("campaigns")
    .update({
      description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("user_id", ownerId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findOwnedCollectionEntry<
  K extends keyof CampaignHomebrewCollections
>(ownerId: number, collectionKey: K, itemId: string): Promise<OwnedCollectionMatch<K> | null> {
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,description")
    .eq("user_id", ownerId);

  if (error) {
    throw new Error(error.message);
  }

  for (const campaign of campaigns ?? []) {
    const parsed = parseCampaignDescription(campaign.description);
    const normalized = normalizeCampaignMetadata(parsed.metadata);
    const homebrew = resolveCampaignHomebrew(normalized);
    const collection = homebrew[collectionKey] as Array<{ id: string }>;
    const item = collection.find((entry) => entry.id === itemId);
    if (!item) continue;

    return {
      campaignId: Number(campaign.id),
      notes: parsed.notes,
      metadata: normalized,
      homebrew,
      item: item as CampaignHomebrewCollections[K][number],
    };
  }

  return null;
}
