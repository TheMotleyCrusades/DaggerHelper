import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { mapArmorRow } from "@/lib/equipment";
import {
  fetchRowById,
  hasInventoryReference,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const armorPatchSchema = z.object({
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
  isArchived: z.boolean().optional(),
  baseThresholds: z.number().int().min(0).max(999).optional(),
  baseScore: z.number().int().min(0).max(999).optional(),
  feature: z.string().max(2000).optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) throw new Error("Invalid armor id");
  return id;
}

function normalizeTags(tags: string[] | undefined, fallback: string[]) {
  if (!tags) return fallback;
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

async function assertWriteAccess(armorId: string, userId: number) {
  const row = await fetchRowById("armor", armorId);
  if (!row) return null;
  const armor = mapArmorRow(row);

  if (armor.scope === "official") {
    return { armor, forbidden: "Official armor is read-only." };
  }
  if (armor.scope === "personal" && armor.ownerUserId !== userId) {
    return { armor, forbidden: "You do not own this personal armor." };
  }
  if (armor.scope === "campaign") {
    if (!armor.campaignId) {
      return { armor, forbidden: "Campaign armor is missing campaign id." };
    }
    const owned = await requireCampaignOwner(armor.campaignId, userId);
    if (!owned) {
      return { armor, forbidden: "Only campaign GMs can edit campaign armor." };
    }
  }

  return { armor, forbidden: null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const armorId = parseId((await params).id);
    const access = await assertWriteAccess(armorId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Armor not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const body = await request.json();
    const parsed = armorPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    const current = access.armor;
    const nextName = patch.name?.trim() || current.name;
    const nextBaseMajor = patch.baseMajorThreshold ?? patch.baseThresholds ?? current.baseMajorThreshold;
    const updateRow = {
      slug: patch.name ? slugify(nextName) : current.slug,
      name: nextName,
      tier: patch.tier ?? current.tier,
      base_major_threshold: nextBaseMajor,
      base_severe_threshold:
        patch.baseSevereThreshold ?? Math.max(0, nextBaseMajor * 2),
      base_armor_score: patch.baseArmorScore ?? patch.baseScore ?? current.baseArmorScore,
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
      .from("armor")
      .update(updateRow)
      .eq("id", armorId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapArmorRow(data as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update armor" },
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
    const armorId = parseId((await params).id);
    const access = await assertWriteAccess(armorId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Armor not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const referenced = await hasInventoryReference("armor", armorId);
    const { error } = await supabaseAdmin
      .from("armor")
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", armorId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, archived: true, referenced });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive armor" },
      { status: 500 }
    );
  }
}

