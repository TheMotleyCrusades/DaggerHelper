import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  loadHudSnapshot,
  parseCampaignId,
  requireHudOwnerContext,
} from "@/lib/hud";
import { tableMissingError } from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const hudSettingsSchema = z.object({
  enabledFields: z.array(z.string().min(1)).optional(),
  pinnedPlayerFields: z.array(z.string().min(1)).optional(),
  pinnedAdversaryFields: z.array(z.string().min(1)).optional(),
  defaultEncounterView: z.enum(["split", "players", "adversaries"]).optional(),
  allowPublicAdversarySearch: z.boolean().optional(),
});

const hudUpdateSchema = z.object({
  settings: hudSettingsSchema.optional(),
  liveEncounter: z
    .object({
      sourceEncounterId: z.number().int().positive().nullable().optional(),
      name: z.string().max(160).nullable().optional(),
      status: z.enum(["idle", "active", "paused", "complete"]).optional(),
      sceneNotes: z.string().max(6000).nullable().optional(),
    })
    .optional(),
});

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseCampaignId((await params).id);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can access the GM HUD." },
        { status: 403 }
      );
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load GM HUD" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseCampaignId((await params).id);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can update GM HUD state." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = hudUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("campaign_hud_states")
      .select("*")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (existingError) {
      if (tableMissingError(existingError)) {
        return NextResponse.json(
          { error: "HUD runtime schema is missing. Apply schema.sql first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const payload = parsed.data;
    const existingSettings = asObject(existing?.settings);
    const mergedSettings = payload.settings
      ? { ...existingSettings, ...payload.settings }
      : existingSettings;
    const encounterPatch = payload.liveEncounter ?? {};

    const row = {
      campaign_id: campaignId,
      source_encounter_id:
        encounterPatch.sourceEncounterId !== undefined
          ? encounterPatch.sourceEncounterId
          : existing?.source_encounter_id ?? null,
      encounter_name:
        encounterPatch.name !== undefined
          ? encounterPatch.name
          : existing?.encounter_name ?? null,
      status:
        encounterPatch.status !== undefined
          ? encounterPatch.status
          : existing?.status ?? "idle",
      scene_notes:
        encounterPatch.sceneNotes !== undefined
          ? encounterPatch.sceneNotes
          : existing?.scene_notes ?? null,
      settings: mergedSettings,
      updated_by_user_id: appUser.id,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("campaign_hud_states")
      .upsert(row, { onConflict: "campaign_id" });

    if (upsertError) {
      if (tableMissingError(upsertError)) {
        return NextResponse.json(
          { error: "HUD runtime schema is missing. Apply schema.sql first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update GM HUD state" },
      { status: 500 }
    );
  }
}
