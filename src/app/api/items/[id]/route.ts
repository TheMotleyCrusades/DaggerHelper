import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { mapItemRow } from "@/lib/equipment";
import {
  fetchRowById,
  hasInventoryReference,
  requireCampaignOwner,
  slugify,
} from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const itemPatchSchema = z.object({
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
  isArchived: z.boolean().optional(),
  description: z.string().max(4000).optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) throw new Error("Invalid item id");
  return id;
}

function normalizeTags(tags: string[] | undefined, fallback: string[]) {
  if (!tags) return fallback;
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

async function assertWriteAccess(itemId: string, userId: number) {
  const row = await fetchRowById("items", itemId);
  if (!row) return null;
  const item = mapItemRow(row);

  if (item.scope === "official") {
    return { item, forbidden: "Official items are read-only." };
  }
  if (item.scope === "personal" && item.ownerUserId !== userId) {
    return { item, forbidden: "You do not own this personal item." };
  }
  if (item.scope === "campaign") {
    if (!item.campaignId) {
      return { item, forbidden: "Campaign item is missing campaign id." };
    }
    const owned = await requireCampaignOwner(item.campaignId, userId);
    if (!owned) {
      return { item, forbidden: "Only campaign GMs can edit campaign items." };
    }
  }

  return { item, forbidden: null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const itemId = parseId((await params).id);
    const access = await assertWriteAccess(itemId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const body = await request.json();
    const parsed = itemPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    const current = access.item;
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
      item_category: patch.itemCategory ?? current.itemCategory,
      can_equip: patch.canEquip ?? current.canEquip,
      equip_label: patch.equipLabel !== undefined ? patch.equipLabel : current.equipLabel,
      stack_limit: patch.stackLimit ?? current.stackLimit,
      sheet_modifiers: patch.sheetModifiers ?? current.sheetModifiers,
      usage_payload: patch.usagePayload ?? current.usagePayload,
      rules_text: nextRulesText,
      tags: normalizeTags(patch.tags, current.tags),
      source_book: patch.sourceBook?.trim() || current.sourceBook,
      source_page: patch.sourcePage !== undefined ? patch.sourcePage : current.sourcePage,
      is_archived: patch.isArchived ?? current.isArchived,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("items")
      .update(updateRow)
      .eq("id", itemId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapItemRow(data as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update item" },
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
    const itemId = parseId((await params).id);
    const access = await assertWriteAccess(itemId, appUser.id);
    if (!access) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (access.forbidden) {
      return NextResponse.json({ error: access.forbidden }, { status: 403 });
    }

    const referenced = await hasInventoryReference("item", itemId);
    const { error } = await supabaseAdmin
      .from("items")
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, archived: true, referenced });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive item" },
      { status: 500 }
    );
  }
}

