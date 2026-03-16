import { getHomepageLeaderboard } from "@/lib/leaderboard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RowWithUpdatedAt = {
  id: number | string;
  name: string | null;
  updated_at: string | null;
};

type CreatorScoreInputs = {
  publishedListedProducts: number;
  freeClaims: number;
  campaignInstalls: number;
  bundleReactions: number;
  recentActivityBonus: number;
  moderationPenalty: number;
};

export type DashboardSummary = {
  counts: {
    campaignsOwned: number;
    campaignsJoined: number;
    characters: number;
    encounters: number;
    adversaries: number;
    publicAdversaries: number;
    personalContentTotals: {
      weapons: number;
      armor: number;
      items: number;
      consumables: number;
      total: number;
    };
  };
  ownedProducts: {
    total: number;
    free: number;
    paid: number;
  };
  creatorScore: {
    value: number;
    inputs: CreatorScoreInputs;
  };
  resumeWork: Array<{
    kind: "campaign" | "character" | "encounter" | "adversary";
    id: number;
    title: string;
    href: string;
    updatedAt: string;
  }>;
  recentCommunityInteraction: {
    myFavouritesCount: number;
    topLiked: Awaited<ReturnType<typeof getHomepageLeaderboard>>["topLiked"];
    topContributors: Awaited<ReturnType<typeof getHomepageLeaderboard>>["topContributors"];
  };
};

function toInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function toEpoch(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(value: string | null, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : fallback;
}

function calculateRecentActivityBonus(lastActivityEpoch: number) {
  if (!lastActivityEpoch) return 0;
  const now = Date.now();
  const ageDays = Math.floor((now - lastActivityEpoch) / (1000 * 60 * 60 * 24));
  if (ageDays <= 30) return 15;
  if (ageDays <= 90) return 5;
  return 0;
}

function computeCreatorScore(inputs: CreatorScoreInputs) {
  const value =
    inputs.publishedListedProducts * 25 +
    inputs.freeClaims * 2 +
    inputs.campaignInstalls * 4 +
    inputs.bundleReactions * 1 +
    inputs.recentActivityBonus -
    inputs.moderationPenalty * 25;
  return Math.max(0, value);
}

async function countPersonalEquipment(userId: number) {
  const [weapons, armor, items, consumables] = await Promise.all([
    supabaseAdmin
      .from("weapons")
      .select("id", { count: "exact", head: true })
      .eq("scope", "personal")
      .eq("owner_user_id", userId),
    supabaseAdmin
      .from("armor")
      .select("id", { count: "exact", head: true })
      .eq("scope", "personal")
      .eq("owner_user_id", userId),
    supabaseAdmin
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("scope", "personal")
      .eq("owner_user_id", userId),
    supabaseAdmin
      .from("consumables")
      .select("id", { count: "exact", head: true })
      .eq("scope", "personal")
      .eq("owner_user_id", userId),
  ]);

  return {
    weapons: toInt(weapons.count),
    armor: toInt(armor.count),
    items: toInt(items.count),
    consumables: toInt(consumables.count),
  };
}

async function loadAccessibleCampaignIds(userId: number) {
  const [ownedResult, membershipResult] = await Promise.all([
    supabaseAdmin.from("campaigns").select("id").eq("user_id", userId),
    supabaseAdmin.from("campaign_members").select("campaign_id").eq("user_id", userId),
  ]);

  const ownedIds = new Set<number>(
    ((ownedResult.data ?? []) as Array<{ id: number }>).map((row) => toInt(row.id))
  );
  const memberIds = new Set<number>(
    ((membershipResult.data ?? []) as Array<{ campaign_id: number }>).map((row) =>
      toInt(row.campaign_id)
    )
  );

  for (const campaignId of ownedIds) {
    memberIds.add(campaignId);
  }

  const allIds = [...memberIds].filter((id) => id > 0);
  return {
    allIds,
    ownedCount: ownedIds.size,
    joinedCount: Math.max(0, allIds.length - ownedIds.size),
  };
}

function toResumeItem(
  kind: "campaign" | "character" | "encounter" | "adversary",
  row: RowWithUpdatedAt | null,
  href: string
) {
  if (!row) return null;
  const updatedAt = row.updated_at;
  if (!updatedAt) return null;

  return {
    kind,
    id: toInt(row.id),
    title: normalizeName(row.name, kind),
    href,
    updatedAt,
  };
}

export async function getDashboardSummary(userId: number): Promise<DashboardSummary> {
  const [
    campaignsInfo,
    charactersCountResult,
    adversariesCountResult,
    publicAdversariesCountResult,
    personalEquipment,
    leaderboard,
    myFavouritesCountResult,
  ] = await Promise.all([
    loadAccessibleCampaignIds(userId),
    supabaseAdmin.from("characters").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("adversaries").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin
      .from("adversaries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_public", true),
    countPersonalEquipment(userId),
    getHomepageLeaderboard(5),
    supabaseAdmin
      .from("adversary_favourites")
      .select("adversary_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const encounterCountResult = campaignsInfo.allIds.length
    ? await supabaseAdmin
        .from("encounters")
        .select("id", { count: "exact", head: true })
        .in("campaign_id", campaignsInfo.allIds)
    : { count: 0 };

  const [latestCharacterResult, latestAdversaryResult, latestCampaignResult, latestEncounterResult] =
    await Promise.all([
      supabaseAdmin
        .from("characters")
        .select("id,name,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("adversaries")
        .select("id,name,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      campaignsInfo.allIds.length
        ? supabaseAdmin
            .from("campaigns")
            .select("id,name,updated_at")
            .in("id", campaignsInfo.allIds)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      campaignsInfo.allIds.length
        ? supabaseAdmin
            .from("encounters")
            .select("id,name,updated_at")
            .in("campaign_id", campaignsInfo.allIds)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const resumeCandidates = [
    toResumeItem(
      "character",
      (latestCharacterResult.data as RowWithUpdatedAt | null) ?? null,
      latestCharacterResult.data
        ? `/dashboard/characters/${toInt((latestCharacterResult.data as { id?: unknown }).id)}`
        : "/dashboard/characters"
    ),
    toResumeItem(
      "adversary",
      (latestAdversaryResult.data as RowWithUpdatedAt | null) ?? null,
      latestAdversaryResult.data
        ? `/dashboard/adversaries/${toInt((latestAdversaryResult.data as { id?: unknown }).id)}`
        : "/dashboard/adversaries"
    ),
    toResumeItem(
      "campaign",
      (latestCampaignResult.data as RowWithUpdatedAt | null) ?? null,
      latestCampaignResult.data
        ? `/dashboard/campaigns/${toInt((latestCampaignResult.data as { id?: unknown }).id)}`
        : "/dashboard/campaigns"
    ),
    toResumeItem(
      "encounter",
      (latestEncounterResult.data as RowWithUpdatedAt | null) ?? null,
      latestEncounterResult.data
        ? `/dashboard/encounters/${toInt((latestEncounterResult.data as { id?: unknown }).id)}`
        : "/dashboard/encounters"
    ),
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => toEpoch(right.updatedAt) - toEpoch(left.updatedAt))
    .slice(0, 5);

  const lastActivityEpoch = resumeCandidates.length ? toEpoch(resumeCandidates[0].updatedAt) : 0;
  const recentActivityBonus = calculateRecentActivityBonus(lastActivityEpoch);
  const creatorScoreInputs: CreatorScoreInputs = {
    publishedListedProducts: 0,
    freeClaims: 0,
    campaignInstalls: 0,
    bundleReactions: 0,
    recentActivityBonus,
    moderationPenalty: 0,
  };

  const personalContentTotal =
    personalEquipment.weapons +
    personalEquipment.armor +
    personalEquipment.items +
    personalEquipment.consumables;

  return {
    counts: {
      campaignsOwned: campaignsInfo.ownedCount,
      campaignsJoined: campaignsInfo.joinedCount,
      characters: toInt(charactersCountResult.count),
      encounters: toInt(encounterCountResult.count),
      adversaries: toInt(adversariesCountResult.count),
      publicAdversaries: toInt(publicAdversariesCountResult.count),
      personalContentTotals: {
        weapons: personalEquipment.weapons,
        armor: personalEquipment.armor,
        items: personalEquipment.items,
        consumables: personalEquipment.consumables,
        total: personalContentTotal,
      },
    },
    ownedProducts: {
      total: 0,
      free: 0,
      paid: 0,
    },
    creatorScore: {
      value: computeCreatorScore(creatorScoreInputs),
      inputs: creatorScoreInputs,
    },
    resumeWork: resumeCandidates,
    recentCommunityInteraction: {
      myFavouritesCount: toInt(myFavouritesCountResult.count),
      topLiked: leaderboard.topLiked,
      topContributors: leaderboard.topContributors,
    },
  };
}
