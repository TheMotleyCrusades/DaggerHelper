import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import {
  collapseByLineage,
  getOfficialItems,
  mapItemRow,
  type ItemCatalogEntry,
} from "@/lib/equipment";
import {
  fetchAllRows,
  getAccessibleCampaign,
  parsePositiveInt,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const itemWriteSchema = z.object({
  scope: z.enum(["personal", "campaign"]).optional(),
  campaignId: z.number().int().positive().optional(),
  cloneFromId: z.string().min(1).optional(),
  lineageKey: z.string().min(1).max(140).optional(),
  name: z.string().min(1).max(120).optional(),
  rarity: z.enum(["common", "uncommon", "rare", "legendary"]).optional(),
  rollValue: z.number().int().nullable().optional(),
  itemCategory: z.enum(["loot", "recipe", "relic", "attachment", "tool", "wearable", "utility"]).optional(),
  canEquip: z.boolean().optional(),
  equipLabel: z.string().max(120).nullable().optional(),
  stackLimit: z.number().int().min(1).max(999).optional(),
  sheetModifiers: z.record(z.string(), z.unknown()).optional(),
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

function matchesSearch(entry: ItemCatalogEntry, search: string) {
  if (!search) return true;
  return (
    entry.name.toLowerCase().includes(search) ||
    entry.rulesText.toLowerCase().includes(search) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(search))
  );
}

function filterByItemQuery(entry: ItemCatalogEntry, request: NextRequest) {
  const rarity = request.nextUrl.searchParams.get("rarity");
  const category = request.nextUrl.searchParams.get("itemCategory");
  const canEquip = request.nextUrl.searchParams.get("canEquip");
  if (rarity && entry.rarity !== rarity) return false;
  if (category && entry.itemCategory !== category) return false;
  if (canEquip === "true" && !entry.canEquip) return false;
  if (canEquip === "false" && entry.canEquip) return false;
  return true;
}

async function loadDbItems() {
  const rows = await fetchAllRows("items");
  return rows.map((row) => mapItemRow(row));
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

    const official = getOfficialItems();
    const dbItems = await loadDbItems();
    const dbOfficial = dbItems.filter((entry) => entry.scope === "official");

    if (scope === "official") {
      const records = [...official, ...dbOfficial]
        .filter((entry) => includeArchived || !entry.isArchived)
        .filter((entry) => matchesSearch(entry, search))
        .filter((entry) => filterByItemQuery(entry, request))
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

    const campaignItems = dbItems.filter(
      (entry) =>
        entry.scope === "campaign" &&
        accessibleCampaignId !== null &&
        entry.campaignId === accessibleCampaignId
    );
    const personalItems = dbItems.filter(
      (entry) => entry.scope === "personal" && entry.ownerUserId === appUser.id
    );

    let selected: ItemCatalogEntry[] = [];
    if (scope === "campaign") {
      if (!accessibleCampaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      selected = campaignItems;
    } else if (scope === "personal") {
      selected = personalItems;
    } else {
      selected = collapseByLineage([...official, ...dbOfficial, ...personalItems, ...campaignItems]);
    }

    const records = selected
      .filter((entry) => includeArchived || !entry.isArchived)
      .filter((entry) => matchesSearch(entry, search))
      .filter((entry) => filterByItemQuery(entry, request))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch items" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = itemWriteSchema.safeParse(body);
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
        return NextResponse.json({ error: "Only campaign GMs can create campaign items" }, { status: 403 });
      }
      campaignId = payload.campaignId;
    }

    const available = [
      ...getOfficialItems(),
      ...(await loadDbItems()),
    ];
    const source = payload.cloneFromId
      ? available.find((entry) => entry.id === payload.cloneFromId)
      : null;
    if (payload.cloneFromId && !source) {
      return NextResponse.json({ error: "cloneFromId source not found" }, { status: 404 });
    }

    const fallbackSource =
      source ??
      getOfficialItems()[0] ?? {
        id: "",
        lineageKey: "",
        scope: "official",
        ownerUserId: null,
        campaignId: null,
        parentId: null,
        slug: "item",
        name: "New Item",
        rarity: "common" as const,
        rollValue: null,
        itemCategory: "utility" as const,
        canEquip: false,
        equipLabel: null,
        stackLimit: 1,
        sheetModifiers: {},
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
      lineage_key: payload.lineageKey?.trim() || fallbackSource.lineageKey || `item-${slugify(name)}`,
      scope,
      owner_user_id: scope === "personal" ? appUser.id : null,
      campaign_id: scope === "campaign" ? campaignId : null,
      parent_id: payload.cloneFromId ?? fallbackSource.id ?? null,
      slug: slugify(name),
      name,
      rarity: payload.rarity ?? fallbackSource.rarity,
      roll_value: payload.rollValue !== undefined ? payload.rollValue : fallbackSource.rollValue,
      item_category: payload.itemCategory ?? fallbackSource.itemCategory,
      can_equip: payload.canEquip ?? fallbackSource.canEquip,
      equip_label: payload.equipLabel !== undefined ? payload.equipLabel : fallbackSource.equipLabel,
      stack_limit: payload.stackLimit ?? fallbackSource.stackLimit,
      sheet_modifiers: payload.sheetModifiers ?? fallbackSource.sheetModifiers,
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
      .from("items")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapItemRow(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create item" },
      { status: 500 }
    );
  }
}

