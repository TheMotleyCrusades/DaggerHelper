import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import {
  collapseByLineage,
  getOfficialWeapons,
  mapWeaponRow,
  type AttackProfile,
  type WeaponCatalogEntry,
} from "@/lib/equipment";
import {
  fetchAllRows,
  getAccessibleCampaign,
  parsePositiveInt,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const attackProfileSchema = z.object({
  label: z.string().min(1).max(80),
  traitMode: z.enum([
    "agility",
    "strength",
    "finesse",
    "instinct",
    "presence",
    "knowledge",
    "spellcast",
  ]),
  rangeBand: z.enum(["melee", "very_close", "close", "far", "very_far"]),
  damageFormula: z.string().min(1).max(80),
  damageType: z.enum(["physical", "magical"]),
});

const weaponWriteSchema = z.object({
  scope: z.enum(["personal", "campaign"]).optional(),
  campaignId: z.number().int().positive().optional(),
  cloneFromId: z.string().min(1).optional(),
  lineageKey: z.string().min(1).max(140).optional(),
  name: z.string().min(1).max(120).optional(),
  tier: z.number().int().min(1).max(10).optional(),
  weaponCategory: z.enum(["primary", "secondary"]).optional(),
  weaponSubtype: z.string().min(1).max(120).optional(),
  requiresSpellcast: z.boolean().optional(),
  burdenHands: z.number().int().min(0).max(4).optional(),
  defaultProfile: attackProfileSchema.optional(),
  alternateProfiles: z.array(attackProfileSchema).optional(),
  sheetModifiers: z.record(z.string(), z.unknown()).optional(),
  featureName: z.string().max(120).nullable().optional(),
  featureText: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  sourceBook: z.string().max(120).optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  trait: z
    .enum(["agility", "strength", "finesse", "instinct", "presence", "knowledge", "spellcast"])
    .optional(),
  rangeCategory: z.enum(["melee", "close", "far"]).optional(),
  damageDice: z.string().min(1).max(80).optional(),
  damageType: z.enum(["physical", "magical"]).optional(),
  feature: z.string().max(2000).optional(),
});

function deriveLegacyProfile(base: WeaponCatalogEntry, patch: z.infer<typeof weaponWriteSchema>) {
  const rangeBand =
    patch.rangeCategory === "melee"
      ? "melee"
      : patch.rangeCategory === "close"
        ? "close"
        : patch.rangeCategory === "far"
          ? "far"
          : base.defaultProfile.rangeBand;

  const nextProfile: AttackProfile = {
    label: base.defaultProfile.label || "Standard Attack",
    traitMode: patch.trait ?? base.defaultProfile.traitMode,
    rangeBand,
    damageFormula: patch.damageDice ?? base.defaultProfile.damageFormula,
    damageType: patch.damageType ?? base.defaultProfile.damageType,
  };

  return nextProfile;
}

function matchesSearch(entry: WeaponCatalogEntry, search: string) {
  if (!search) return true;
  return (
    entry.name.toLowerCase().includes(search) ||
    entry.featureText.toLowerCase().includes(search) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(search)) ||
    entry.defaultProfile.damageFormula.toLowerCase().includes(search)
  );
}

function filterByWeaponQuery(entry: WeaponCatalogEntry, request: NextRequest) {
  const weaponCategory = request.nextUrl.searchParams.get("weaponCategory");
  const subtype = request.nextUrl.searchParams.get("weaponSubtype");
  const tier = parsePositiveInt(request.nextUrl.searchParams.get("tier"), 0);
  const requiresSpellcast = request.nextUrl.searchParams.get("requiresSpellcast");

  if (weaponCategory && entry.weaponCategory !== weaponCategory) return false;
  if (subtype && entry.weaponSubtype !== subtype) return false;
  if (tier > 0 && entry.tier !== tier) return false;
  if (requiresSpellcast === "true" && !entry.requiresSpellcast) return false;
  if (requiresSpellcast === "false" && entry.requiresSpellcast) return false;
  return true;
}

function scopeFromRequest(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope === "official" || scope === "personal" || scope === "campaign" || scope === "available") {
    return scope;
  }
  return "available";
}

async function loadDbWeapons() {
  const rows = await fetchAllRows("weapons");
  return rows.map((row) => mapWeaponRow(row));
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

    const official = getOfficialWeapons();
    const dbWeapons = await loadDbWeapons();
    const dbOfficial = dbWeapons.filter((entry) => entry.scope === "official");

    if (scope === "official") {
      const records = [...official, ...dbOfficial]
        .filter((entry) => includeArchived || !entry.isArchived)
        .filter((entry) => matchesSearch(entry, search))
        .filter((entry) => filterByWeaponQuery(entry, request))
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

    const campaignWeapons = dbWeapons.filter(
      (entry) =>
        entry.scope === "campaign" &&
        accessibleCampaignId !== null &&
        entry.campaignId === accessibleCampaignId
    );
    const personalWeapons = dbWeapons.filter(
      (entry) => entry.scope === "personal" && entry.ownerUserId === appUser.id
    );

    let selected: WeaponCatalogEntry[] = [];
    if (scope === "campaign") {
      if (!accessibleCampaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      selected = campaignWeapons;
    } else if (scope === "personal") {
      selected = personalWeapons;
    } else {
      selected = collapseByLineage([...official, ...dbOfficial, ...personalWeapons, ...campaignWeapons]);
    }

    const records = selected
      .filter((entry) => includeArchived || !entry.isArchived)
      .filter((entry) => matchesSearch(entry, search))
      .filter((entry) => filterByWeaponQuery(entry, request))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch weapons" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = weaponWriteSchema.safeParse(body);
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
        return NextResponse.json({ error: "Only campaign GMs can create campaign weapons" }, { status: 403 });
      }
      campaignId = payload.campaignId;
    }

    const available = [
      ...getOfficialWeapons(),
      ...(await loadDbWeapons()),
    ];
    const source = payload.cloneFromId
      ? available.find((entry) => entry.id === payload.cloneFromId)
      : null;

    if (payload.cloneFromId && !source) {
      return NextResponse.json({ error: "cloneFromId source not found" }, { status: 404 });
    }

    const fallbackSource: WeaponCatalogEntry =
      source ??
      getOfficialWeapons()[0] ?? {
        id: "",
        lineageKey: "",
        scope: "official",
        ownerUserId: null,
        campaignId: null,
        parentId: null,
        slug: "weapon",
        name: "New Weapon",
        tier: 1,
        weaponCategory: "primary",
        weaponSubtype: "standard",
        requiresSpellcast: false,
        burdenHands: 1,
        defaultProfile: {
          label: "Standard Attack",
          traitMode: "strength",
          rangeBand: "melee",
          damageFormula: "d6",
          damageType: "physical",
        },
        alternateProfiles: [],
        sheetModifiers: {},
        featureName: null,
        featureText: "",
        trait: "strength",
        rangeCategory: "melee",
        damageDice: "d6",
        damageType: "physical",
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
    const defaultProfile = payload.defaultProfile
      ? payload.defaultProfile
      : deriveLegacyProfile(fallbackSource, payload);

    const row = {
      lineage_key: payload.lineageKey?.trim() || fallbackSource.lineageKey || `weapon-${slugify(name)}`,
      scope,
      owner_user_id: scope === "personal" ? appUser.id : null,
      campaign_id: scope === "campaign" ? campaignId : null,
      parent_id: payload.cloneFromId ?? fallbackSource.id ?? null,
      slug: slugify(name),
      name,
      tier: payload.tier ?? fallbackSource.tier,
      weapon_category: payload.weaponCategory ?? fallbackSource.weaponCategory,
      weapon_subtype: payload.weaponSubtype?.trim() || fallbackSource.weaponSubtype,
      requires_spellcast: payload.requiresSpellcast ?? fallbackSource.requiresSpellcast,
      burden_hands: payload.burdenHands ?? fallbackSource.burdenHands,
      default_profile: defaultProfile,
      alternate_profiles: payload.alternateProfiles ?? fallbackSource.alternateProfiles,
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
      .from("weapons")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapWeaponRow(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create weapon" },
      { status: 500 }
    );
  }
}
