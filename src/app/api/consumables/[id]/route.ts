import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { mapConsumableRow } from "@/lib/equipment";
import {
  fetchRowById,
  hasInventoryReference,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const consumablePatchSchema = z.object({
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
  isArchived: z.boolean().optional(),
  description: z.string().max(4000).optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) throw new Error("Invalid consumable id");
  return id;
}

function normalizeTags(tags: string[] | undefined, fallback: string[]) {
  if (!tags) return fallback;
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

async function assertWriteAccess(consumableId: string, userId: number) {
  const row = await fetchRowById("consumables", consumableId);
  if (!row) return null;
  const consumable = mapConsumableRow(row);

  if (consumable.scope === "official") {
    return { consumable, forbidden: "Official consumables are read-only." };
  }
  if (consumable.scope === "personal" && consumable.ownerUserId !== userId) {
    return { consumable, forbidden: "You do not own this personal consumable." };
  }
  if (consumable.scope === "campaign") {
    if (!consumable.campaignId) {
      return { consumable, forbidden: "Campaign consumable is missing campaign id." };
    }
    const owned = await requireCampaignOwner(consumable.campaignId, userId);
    if (!owned) {
      return { consumable, forbidden: "Only campaign GMs can edit campaign consumables." };
    }
  }

  return { consumable, forbidden: null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const consumableId = parseId((await params).id);
    const access = await assertWriteAccess(consumableId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Consumable not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const body = await request.json();
    const parsed = consumablePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    const current = access.consumable;
    const nextName = patch.name?.trim() || current.name;
    const nextRulesText =
      patch.rulesText !== undefined
        ? patch.rulesText
        : patch.description !== undefined
          ? patch.description
          : current.rulesText;

    const updateRow = {
      slug: patch.name ? slugify(nextName) : current.slug,
      name: nextName,
      rarity: patch.rarity ?? current.rarity,
      roll_value: patch.rollValue !== undefined ? patch.rollValue : current.rollValue,
      consumable_category: patch.consumableCategory ?? current.consumableCategory,
      stack_limit: patch.stackLimit ?? current.stackLimit,
      usage_payload: patch.usagePayload ?? current.usagePayload,
      rules_text: nextRulesText,
      tags: normalizeTags(patch.tags, current.tags),
      source_book: patch.sourceBook?.trim() || current.sourceBook,
      source_page: patch.sourcePage !== undefined ? patch.sourcePage : current.sourcePage,
      is_archived: patch.isArchived ?? current.isArchived,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("consumables")
      .update(updateRow)
      .eq("id", consumableId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapConsumableRow(data as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update consumable" },
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
    const consumableId = parseId((await params).id);
    const access = await assertWriteAccess(consumableId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Consumable not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const referenced = await hasInventoryReference("consumable", consumableId);
    const { error } = await supabaseAdmin
      .from("consumables")
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", consumableId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, archived: true, referenced });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive consumable" },
      { status: 500 }
    );
  }
}

