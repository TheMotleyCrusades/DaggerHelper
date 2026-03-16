import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import {
  collapseByLineage,
  getOfficialConsumables,
  mapConsumableRow,
  type ConsumableCatalogEntry,
} from "@/lib/equipment";
import {
  fetchAllRows,
  getAccessibleCampaign,
  parsePositiveInt,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const consumableWriteSchema = z.object({
  scope: z.enum(["personal", "campaign"]).optional(),
  campaignId: z.number().int().positive().optional(),
  cloneFromId: z.string().min(1).optional(),
  lineageKey: z.string().min(1).max(140).optional(),
  name: z.string().min(1).max(120).optional(),
  rarity: z.enum(["common", "uncommon", "rare", "legendary"]).optional(),
  rollValue: z.number().int().nullable().optional(),
  consumableCategory: z.enum(["potion", "poison", "salve", "bomb", "food", "scroll", "other"]).optional(),
  stackLimit: z.number().int().min(1).max(999).optional(),
  usagePayload: z.record(z.string(), z.unknown()).optional(),
  rulesText: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  sourceBook: z.string().max(120).optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  description: z.string().max(4000).optional(),
});

function scopeFromRequest(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "official" || scope === "personal" || scope === "campaign" || scope === "available") {
    return scope;
  }
  return "available";
}

function matchesSearch(entry: ConsumableCatalogEntry, search: string) {
  if (!search) return true;
  return (
    entry.name.toLowerCase().includes(search) ||
    entry.rulesText.toLowerCase().includes(search) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(search))
  );
}

function filterByConsumableQuery(entry: ConsumableCatalogEntry, request: NextRequest) {
  const rarity = request.nextUrl.searchParams.get("rarity");
  const category = request.nextUrl.searchParams.get("consumableCategory");
  if (rarity && entry.rarity !== rarity) return false;
  if (category && entry.consumableCategory !== category) return false;
  return true;
}

async function loadDbConsumables() {
  const rows = await fetchAllRows("consumables");
  return rows.map((row) => mapConsumableRow(row));
}

function normalizeTags(tags: string[] | undefined) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const scope = scopeFromRequest(request);
    const campaignId = parsePositiveInt(request.nextUrl.searchParams.get("campaignId"), 0);
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

    const official = getOfficialConsumables();
    const dbConsumables = await loadDbConsumables();
    const dbOfficial = dbConsumables.filter((entry) => entry.scope === "official");

    if (scope === "official") {
      const records = [...official, ...dbOfficial]
        .filter((entry) => includeArchived || !entry.isArchived)
        .filter((entry) => matchesSearch(entry, search))
        .filter((entry) => filterByConsumableQuery(entry, request))
        .sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json(records);
    }

    const authUser = await getSessionUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const appUser = await getOrCreateAppUser(authUser);

    let accessibleCampaignId: number | null = null;
    if (campaignId > 0) {
      const campaign = await getAccessibleCampaign(campaignId, appUser.id);
      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      accessibleCampaignId = Number(campaign.id);
    }

    const campaignEntries = dbConsumables.filter(
      (entry) =>
        entry.scope === "campaign" &&
        accessibleCampaignId !== null &&
        entry.campaignId === accessibleCampaignId
    );
    const personalEntries = dbConsumables.filter(
      (entry) => entry.scope === "personal" && entry.ownerUserId === appUser.id
    );

    let selected: ConsumableCatalogEntry[] = [];
    if (scope === "campaign") {
      if (!accessibleCampaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      selected = campaignEntries;
    } else if (scope === "personal") {
      selected = personalEntries;
    } else {
      selected = collapseByLineage([...official, ...dbOfficial, ...personalEntries, ...campaignEntries]);
    }

    const records = selected
      .filter((entry) => includeArchived || !entry.isArchived)
      .filter((entry) => matchesSearch(entry, search))
      .filter((entry) => filterByConsumableQuery(entry, request))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch consumables" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = consumableWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const scope = payload.scope ?? (payload.campaignId ? "campaign" : "personal");
    let campaignId: number | null = null;
    if (scope === "campaign") {
      if (!payload.campaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      const owned = await requireCampaignOwner(payload.campaignId, appUser.id);
      if (!owned) {
        return NextResponse.json({ error: "Only campaign GMs can create campaign consumables" }, { status: 403 });
      }
      campaignId = payload.campaignId;
    }

    const available = [
      ...getOfficialConsumables(),
      ...(await loadDbConsumables()),
    ];
    const source = payload.cloneFromId
      ? available.find((entry) => entry.id === payload.cloneFromId)
      : null;
    if (payload.cloneFromId && !source) {
      return NextResponse.json({ error: "cloneFromId source not found" }, { status: 404 });
    }

    const fallbackSource =
      source ??
      getOfficialConsumables()[0] ?? {
        id: "",
        lineageKey: "",
        scope: "official",
        ownerUserId: null,
        campaignId: null,
        parentId: null,
        slug: "consumable",
        name: "New Consumable",
        rarity: "common" as const,
        rollValue: null,
        consumableCategory: "other" as const,
        stackLimit: 1,
        usagePayload: {},
        rulesText: "",
        description: "",
        tags: [],
        sourceBook: "Custom",
        sourcePage: null,
        isArchived: false,
        createdAt: null,
        updatedAt: null,
        isOfficial: true,
      };

    const name = payload.name?.trim() || fallbackSource.name;
    const rulesText = payload.rulesText ?? payload.description ?? fallbackSource.rulesText;

    const row = {
      lineage_key:
        payload.lineageKey?.trim() || fallbackSource.lineageKey || `consumable-${slugify(name)}`,
      scope,
      owner_user_id: scope === "personal" ? appUser.id : null,
      campaign_id: scope === "campaign" ? campaignId : null,
      parent_id: payload.cloneFromId ?? fallbackSource.id ?? null,
      slug: slugify(name),
      name,
      rarity: payload.rarity ?? fallbackSource.rarity,
      roll_value: payload.rollValue !== undefined ? payload.rollValue : fallbackSource.rollValue,
      consumable_category: payload.consumableCategory ?? fallbackSource.consumableCategory,
      stack_limit: payload.stackLimit ?? fallbackSource.stackLimit,
      usage_payload: payload.usagePayload ?? fallbackSource.usagePayload,
      rules_text: rulesText,
      tags: normalizeTags(payload.tags ?? fallbackSource.tags),
      source_book: payload.sourceBook?.trim() || fallbackSource.sourceBook || "Custom",
      source_page:
        payload.sourcePage !== undefined ? payload.sourcePage : fallbackSource.sourcePage,
      is_archived: false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("consumables")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapConsumableRow(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create consumable" },
      { status: 500 }
    );
  }
}

