import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import {
  collapseByLineage,
  getOfficialArmor,
  mapArmorRow,
  type ArmorCatalogEntry,
} from "@/lib/equipment";
import {
  fetchAllRows,
  getAccessibleCampaign,
  parsePositiveInt,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const armorWriteSchema = z.object({
  scope: z.enum(["personal", "campaign"]).optional(),
  campaignId: z.number().int().positive().optional(),
  cloneFromId: z.string().min(1).optional(),
  lineageKey: z.string().min(1).max(140).optional(),
  name: z.string().min(1).max(120).optional(),
  tier: z.number().int().min(1).max(10).optional(),
  baseMajorThreshold: z.number().int().min(0).max(999).optional(),
  baseSevereThreshold: z.number().int().min(0).max(999).optional(),
  baseArmorScore: z.number().int().min(0).max(999).optional(),
  sheetModifiers: z.record(z.string(), z.unknown()).optional(),
  featureName: z.string().max(120).nullable().optional(),
  featureText: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  sourceBook: z.string().max(120).optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  baseThresholds: z.number().int().min(0).max(999).optional(),
  baseScore: z.number().int().min(0).max(999).optional(),
  feature: z.string().max(2000).optional(),
});

function scopeFromRequest(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "official" || scope === "personal" || scope === "campaign" || scope === "available") {
    return scope;
  }
  return "available";
}

function matchesSearch(entry: ArmorCatalogEntry, search: string) {
  if (!search) return true;
  return (
    entry.name.toLowerCase().includes(search) ||
    entry.featureText.toLowerCase().includes(search) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(search))
  );
}

function filterByArmorQuery(entry: ArmorCatalogEntry, request: NextRequest) {
  const tier = parsePositiveInt(request.nextUrl.searchParams.get("tier"), 0);
  if (tier > 0 && entry.tier !== tier) return false;
  return true;
}

async function loadDbArmor() {
  const rows = await fetchAllRows("armor");
  return rows.map((row) => mapArmorRow(row));
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

    const official = getOfficialArmor();
    const dbArmor = await loadDbArmor();
    const dbOfficial = dbArmor.filter((entry) => entry.scope === "official");

    if (scope === "official") {
      const records = [...official, ...dbOfficial]
        .filter((entry) => includeArchived || !entry.isArchived)
        .filter((entry) => matchesSearch(entry, search))
        .filter((entry) => filterByArmorQuery(entry, request))
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

    const campaignArmor = dbArmor.filter(
      (entry) =>
        entry.scope === "campaign" &&
        accessibleCampaignId !== null &&
        entry.campaignId === accessibleCampaignId
    );
    const personalArmor = dbArmor.filter(
      (entry) => entry.scope === "personal" && entry.ownerUserId === appUser.id
    );

    let selected: ArmorCatalogEntry[] = [];
    if (scope === "campaign") {
      if (!accessibleCampaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      selected = campaignArmor;
    } else if (scope === "personal") {
      selected = personalArmor;
    } else {
      selected = collapseByLineage([...official, ...dbOfficial, ...personalArmor, ...campaignArmor]);
    }

    const records = selected
      .filter((entry) => includeArchived || !entry.isArchived)
      .filter((entry) => matchesSearch(entry, search))
      .filter((entry) => filterByArmorQuery(entry, request))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch armor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = armorWriteSchema.safeParse(body);
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
        return NextResponse.json({ error: "Only campaign GMs can create campaign armor" }, { status: 403 });
      }
      campaignId = payload.campaignId;
    }

    const available = [
      ...getOfficialArmor(),
      ...(await loadDbArmor()),
    ];
    const source = payload.cloneFromId
      ? available.find((entry) => entry.id === payload.cloneFromId)
      : null;

    if (payload.cloneFromId && !source) {
      return NextResponse.json({ error: "cloneFromId source not found" }, { status: 404 });
    }

    const fallbackSource =
      source ??
      getOfficialArmor()[0] ?? {
        id: "",
        lineageKey: "",
        scope: "official",
        ownerUserId: null,
        campaignId: null,
        parentId: null,
        slug: "armor",
        name: "New Armor",
        tier: 1,
        baseMajorThreshold: 0,
        baseSevereThreshold: 0,
        baseArmorScore: 0,
        sheetModifiers: {},
        featureName: null,
        featureText: "",
        baseThresholds: 0,
        baseScore: 0,
        feature: "",
        tags: [],
        sourceBook: "Custom",
        sourcePage: null,
        isArchived: false,
        createdAt: null,
        updatedAt: null,
        isOfficial: true,
      };

    const name = payload.name?.trim() || fallbackSource.name;
    const baseMajorThreshold =
      payload.baseMajorThreshold ??
      payload.baseThresholds ??
      fallbackSource.baseMajorThreshold;
    const baseArmorScore = payload.baseArmorScore ?? payload.baseScore ?? fallbackSource.baseArmorScore;
    const baseSevereThreshold =
      payload.baseSevereThreshold ?? Math.max(0, baseMajorThreshold * 2);

    const row = {
      lineage_key: payload.lineageKey?.trim() || fallbackSource.lineageKey || `armor-${slugify(name)}`,
      scope,
      owner_user_id: scope === "personal" ? appUser.id : null,
      campaign_id: scope === "campaign" ? campaignId : null,
      parent_id: payload.cloneFromId ?? fallbackSource.id ?? null,
      slug: slugify(name),
      name,
      tier: payload.tier ?? fallbackSource.tier,
      base_major_threshold: baseMajorThreshold,
      base_severe_threshold: baseSevereThreshold,
      base_armor_score: baseArmorScore,
      sheet_modifiers: payload.sheetModifiers ?? fallbackSource.sheetModifiers,
      feature_name:
        payload.featureName !== undefined ? payload.featureName : fallbackSource.featureName,
      feature_text:
        payload.featureText !== undefined
          ? payload.featureText
          : payload.feature !== undefined
            ? payload.feature
            : fallbackSource.featureText,
      tags: normalizeTags(payload.tags ?? fallbackSource.tags),
      source_book: payload.sourceBook?.trim() || fallbackSource.sourceBook || "Custom",
      source_page:
        payload.sourcePage !== undefined ? payload.sourcePage : fallbackSource.sourcePage,
      is_archived: false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("armor")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapArmorRow(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create armor" },
      { status: 500 }
    );
  }
}

