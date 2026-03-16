import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { mapWeaponRow } from "@/lib/equipment";
import {
  fetchRowById,
  hasInventoryReference,
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

const weaponPatchSchema = z.object({
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
  isArchived: z.boolean().optional(),
  trait: z
    .enum(["agility", "strength", "finesse", "instinct", "presence", "knowledge", "spellcast"])
    .optional(),
  rangeCategory: z.enum(["melee", "close", "far"]).optional(),
  damageDice: z.string().min(1).max(80).optional(),
  damageType: z.enum(["physical", "magical"]).optional(),
  feature: z.string().max(2000).optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) throw new Error("Invalid weapon id");
  return id;
}

function normalizeTags(tags: string[] | undefined, fallback: string[]) {
  if (!tags) return fallback;
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

function toRangeBand(value: "melee" | "close" | "far") {
  return value === "melee" ? "melee" : value === "close" ? "close" : "far";
}

async function assertWriteAccess(weaponId: string, userId: number) {
  const row = await fetchRowById("weapons", weaponId);
  if (!row) return null;
  const weapon = mapWeaponRow(row);

  if (weapon.scope === "official") {
    return { weapon, forbidden: "Official weapons are read-only." };
  }
  if (weapon.scope === "personal" && weapon.ownerUserId !== userId) {
    return { weapon, forbidden: "You do not own this personal weapon." };
  }
  if (weapon.scope === "campaign") {
    if (!weapon.campaignId) {
      return { weapon, forbidden: "Campaign weapon is missing campaign id." };
    }
    const owned = await requireCampaignOwner(weapon.campaignId, userId);
    if (!owned) {
      return { weapon, forbidden: "Only campaign GMs can edit campaign weapons." };
    }
  }

  return { weapon, forbidden: null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const weaponId = parseId((await params).id);
    const access = await assertWriteAccess(weaponId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Weapon not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const body = await request.json();
    const parsed = weaponPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    const current = access.weapon;
    const nextDefaultProfile = patch.defaultProfile
      ? patch.defaultProfile
      : {
          ...current.defaultProfile,
          traitMode: patch.trait ?? current.defaultProfile.traitMode,
          rangeBand: patch.rangeCategory ? toRangeBand(patch.rangeCategory) : current.defaultProfile.rangeBand,
          damageFormula: patch.damageDice ?? current.defaultProfile.damageFormula,
          damageType: patch.damageType ?? current.defaultProfile.damageType,
        };

    const nextName = patch.name?.trim() || current.name;
    const updateRow = {
      slug: patch.name ? slugify(nextName) : current.slug,
      name: nextName,
      tier: patch.tier ?? current.tier,
      weapon_category: patch.weaponCategory ?? current.weaponCategory,
      weapon_subtype: patch.weaponSubtype?.trim() || current.weaponSubtype,
      requires_spellcast: patch.requiresSpellcast ?? current.requiresSpellcast,
      burden_hands: patch.burdenHands ?? current.burdenHands,
      default_profile: nextDefaultProfile,
      alternate_profiles: patch.alternateProfiles ?? current.alternateProfiles,
      sheet_modifiers: patch.sheetModifiers ?? current.sheetModifiers,
      feature_name:
        patch.featureName !== undefined ? patch.featureName : current.featureName,
      feature_text:
        patch.featureText !== undefined
          ? patch.featureText
          : patch.feature !== undefined
            ? patch.feature
            : current.featureText,
      tags: normalizeTags(patch.tags, current.tags),
      source_book: patch.sourceBook?.trim() || current.sourceBook,
      source_page: patch.sourcePage !== undefined ? patch.sourcePage : current.sourcePage,
      is_archived: patch.isArchived ?? current.isArchived,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("weapons")
      .update(updateRow)
      .eq("id", weaponId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapWeaponRow(data as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update weapon" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const weaponId = parseId((await params).id);
    const access = await assertWriteAccess(weaponId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Weapon not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const referenced = await hasInventoryReference("weapon", weaponId);
    const { error } = await supabaseAdmin
      .from("weapons")
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", weaponId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, archived: true, referenced });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive weapon" },
      { status: 500 }
    );
  }
}

