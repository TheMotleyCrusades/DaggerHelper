import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { mapCharacterRow } from "@/lib/characters";
import { tableMissingError } from "@/lib/equipment-api";
import {
  applyHudFieldPatchToCharacter,
  buildCharacterUpdateRowFromHud,
  buildHudFieldDefinitions,
  loadHudSnapshot,
  normalizeConditionStatePatch,
  parseCampaignId,
  requireHudOwnerContext,
} from "@/lib/hud";
import { supabaseAdmin } from "@/lib/supabase/admin";

const patchCharacterSchema = z.object({
  fieldId: z.string().min(1).optional(),
  current: z.union([z.number(), z.string(), z.boolean(), z.null()]).optional(),
  max: z.number().int().nullable().optional(),
  delta: z.number().int().optional(),
  activeConditions: z.array(z.string().min(1)).optional(),
  toggleConditionId: z.string().min(1).optional(),
  gmNotes: z.string().max(4000).nullable().optional(),
});

function parseCharacterId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid character id");
  }
  return id;
}

function uniqueStrings(values: string[]) {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return Array.from(new Set(normalized));
}

function toggleCondition(conditions: string[], conditionId: string) {
  const trimmed = conditionId.trim();
  if (!trimmed) return conditions;
  if (conditions.includes(trimmed)) {
    return conditions.filter((condition) => condition !== trimmed);
  }
  return [...conditions, trimmed];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const routeParams = await params;
    const campaignId = parseCampaignId(routeParams.id);
    const characterId = parseCharacterId(routeParams.characterId);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can update live player state." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = patchCharacterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const { data: characterRow, error: characterError } = await supabaseAdmin
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (characterError) {
      return NextResponse.json({ error: characterError.message }, { status: 500 });
    }
    if (!characterRow) {
      return NextResponse.json({ error: "Character not found in this campaign." }, { status: 404 });
    }

    const mappedCharacter = mapCharacterRow(characterRow as Record<string, unknown>);
    const fieldDefinitions = buildHudFieldDefinitions(context.settings);
    const fieldDefinition = payload.fieldId
      ? fieldDefinitions.find((field) => field.id === payload.fieldId)
      : null;

    if (payload.fieldId && !fieldDefinition) {
      return NextResponse.json({ error: "Unknown HUD field id." }, { status: 400 });
    }

    const hudPatch =
      fieldDefinition && (payload.current !== undefined || payload.max !== undefined || payload.delta !== undefined)
        ? applyHudFieldPatchToCharacter(mappedCharacter, fieldDefinition, {
            current: payload.current,
            max: payload.max,
            delta: payload.delta,
          })
        : {};

    const currentActiveConditions = Object.entries(mappedCharacter.conditionStates)
      .filter(([, value]) => value)
      .map(([conditionId]) => conditionId);
    let nextActiveConditions =
      payload.activeConditions !== undefined
        ? uniqueStrings(payload.activeConditions)
        : uniqueStrings(currentActiveConditions);
    if (payload.toggleConditionId) {
      nextActiveConditions = toggleCondition(nextActiveConditions, payload.toggleConditionId);
    }

    const hasConditionPatch =
      payload.activeConditions !== undefined || payload.toggleConditionId !== undefined;
    const conditionStates = hasConditionPatch
      ? normalizeConditionStatePatch(mappedCharacter.conditionStates, nextActiveConditions)
      : undefined;

    const updateRow = buildCharacterUpdateRowFromHud(
      characterRow as Record<string, unknown>,
      {
        ...hudPatch,
        conditionStates,
      },
      context.settings
    );

    const { error: updateError } = await supabaseAdmin
      .from("characters")
      .update({
        ...updateRow,
        updated_at: new Date().toISOString(),
      })
      .eq("id", characterId)
      .eq("campaign_id", campaignId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: existingOverlay, error: overlayLoadError } = await supabaseAdmin
      .from("campaign_hud_character_overlays")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .maybeSingle();
    if (overlayLoadError && !tableMissingError(overlayLoadError)) {
      return NextResponse.json({ error: overlayLoadError.message }, { status: 500 });
    }
    if (overlayLoadError && tableMissingError(overlayLoadError)) {
      return NextResponse.json(
        { error: "HUD runtime schema is missing. Apply schema.sql first." },
        { status: 409 }
      );
    }

    const overlayRow = {
      campaign_id: campaignId,
      character_id: characterId,
      tracked_fields: {},
      conditions:
        hasConditionPatch
          ? nextActiveConditions
          : existingOverlay?.conditions ?? [],
      gm_notes:
        payload.gmNotes !== undefined
          ? payload.gmNotes
          : existingOverlay?.gm_notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: overlayUpsertError } = await supabaseAdmin
      .from("campaign_hud_character_overlays")
      .upsert(overlayRow, { onConflict: "campaign_id,character_id" });
    if (overlayUpsertError) {
      if (tableMissingError(overlayUpsertError)) {
        return NextResponse.json(
          { error: "HUD runtime schema is missing. Apply schema.sql first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: overlayUpsertError.message }, { status: 500 });
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update live player state" },
      { status: 500 }
    );
  }
}
