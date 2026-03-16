import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { resolveCharacterEquipment } from "@/lib/character-inventory";
import { mapCharacterRow } from "@/lib/characters";
import { mapInventoryRow } from "@/lib/equipment";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid character id");
  }
  return parsed;
}

const inventoryEntryInputSchema = z.object({
  entityKind: z.enum(["weapon", "armor", "item", "consumable"]),
  entityId: z.string().min(1),
  quantity: z.number().int().min(1).max(999).default(1),
  isEquipped: z.boolean().default(false),
  equippedSlot: z.enum(["primary_weapon", "secondary_weapon", "armor"]).nullable().default(null),
  notes: z.string().max(1200).default(""),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

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

function isMissingTableError(error: { message?: string; details?: string } | null) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("could not find the table");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const characterId = parseId((await params).id);
    const characterRow = await requireOwnedCharacter(characterId, appUser.id);
    if (!characterRow) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("character_inventory_entries")
      .select("*")
      .eq("character_id", characterId)
      .order("sort_order", { ascending: true });

    if (error) {
      if (isMissingTableError(error)) {
        const resolved = await resolveCharacterEquipment(mapCharacterRow(characterRow));
        return NextResponse.json(resolved.inventory ?? []);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapInventoryRow(row))
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load inventory" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const characterId = parseId((await params).id);
    const characterRow = await requireOwnedCharacter(characterId, appUser.id);
    if (!characterRow) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = inventoryEntryInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const defaultSlot =
      payload.entityKind === "weapon"
        ? "primary_weapon"
        : payload.entityKind === "armor"
          ? "armor"
          : null;
    const equippedSlot =
      payload.isEquipped && payload.equippedSlot === null ? defaultSlot : payload.equippedSlot;

    const { data, error } = await supabaseAdmin
      .from("character_inventory_entries")
      .insert({
        character_id: characterId,
        entity_kind: payload.entityKind,
        entity_id: payload.entityId,
        quantity: payload.quantity,
        is_equipped: payload.isEquipped,
        equipped_slot: equippedSlot,
        notes: payload.notes,
        sort_order: payload.sortOrder,
      })
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
      { error: error instanceof Error ? error.message : "Failed to add inventory entry" },
      { status: 500 }
    );
  }
}

