import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { resolveCharacterEquipment } from "@/lib/character-inventory";
import { mapCharacterRow } from "@/lib/characters";
import { mapInventoryRow } from "@/lib/equipment";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseCharacterId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid character id");
  }
  return parsed;
}

function parseEntryId(value: string) {
  const parsed = value.trim();
  if (!parsed.length) {
    throw new Error("Invalid inventory entry id");
  }
  return parsed;
}

const inventoryEntryPatchSchema = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  isEquipped: z.boolean().optional(),
  equippedSlot: z.enum(["primary_weapon", "secondary_weapon", "armor"]).nullable().optional(),
  notes: z.string().max(1200).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

function isMissingTableError(error: { message?: string; details?: string } | null) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("could not find the table");
}

async function requireOwnedCharacter(characterId: number, userId: number) {
  const { data, error } = await supabaseAdmin
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Record<string, unknown> | null;
}

async function requireOwnedInventoryEntry(characterId: number, entryId: string) {
  const { data, error } = await supabaseAdmin
    .from("character_inventory_entries")
    .select("*")
    .eq("id", entryId)
    .eq("character_id", characterId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Record<string, unknown> | null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const resolvedParams = await params;
    const characterId = parseCharacterId(resolvedParams.id);
    const entryId = parseEntryId(resolvedParams.entryId);

    const characterRow = await requireOwnedCharacter(characterId, appUser.id);
    if (!characterRow) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const existing = await requireOwnedInventoryEntry(characterId, entryId);
    if (!existing) {
      return NextResponse.json({ error: "Inventory entry not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = inventoryEntryPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    const nextEquipped =
      patch.isEquipped ?? Boolean(existing.is_equipped);
    const defaultSlot =
      existing.entity_kind === "weapon"
        ? "primary_weapon"
        : existing.entity_kind === "armor"
          ? "armor"
          : null;

    const nextSlot =
      nextEquipped && patch.equippedSlot === undefined
        ? (existing.equipped_slot ?? defaultSlot)
        : patch.equippedSlot === undefined
          ? existing.equipped_slot
          : patch.equippedSlot;

    const { data, error } = await supabaseAdmin
      .from("character_inventory_entries")
      .update({
        quantity: patch.quantity ?? existing.quantity,
        is_equipped: nextEquipped,
        equipped_slot: nextSlot,
        notes: patch.notes ?? existing.notes,
        sort_order: patch.sortOrder ?? existing.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .eq("character_id", characterId)
      .select("*")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Inventory table not found. Apply runtime schema migration first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resolvedCharacter = await resolveCharacterEquipment(mapCharacterRow(characterRow));
    return NextResponse.json({
      entry: mapInventoryRow(data as Record<string, unknown>),
      character: resolvedCharacter,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update inventory entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const resolvedParams = await params;
    const characterId = parseCharacterId(resolvedParams.id);
    const entryId = parseEntryId(resolvedParams.entryId);

    const characterRow = await requireOwnedCharacter(characterId, appUser.id);
    if (!characterRow) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const existing = await requireOwnedInventoryEntry(characterId, entryId);
    if (!existing) {
      return NextResponse.json({ error: "Inventory entry not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("character_inventory_entries")
      .delete()
      .eq("id", entryId)
      .eq("character_id", characterId);

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: "Inventory table not found. Apply runtime schema migration first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resolvedCharacter = await resolveCharacterEquipment(mapCharacterRow(characterRow));
    return NextResponse.json({ success: true, character: resolvedCharacter });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete inventory entry" },
      { status: 500 }
    );
  }
}

