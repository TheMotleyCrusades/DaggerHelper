import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { loadHudSnapshot, parseCampaignId, requireHudOwnerContext } from "@/lib/hud";
import { tableMissingError } from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const patchAdversaryInstanceSchema = z.object({
  displayName: z.string().min(1).max(140).optional(),
  hpCurrent: z.number().int().nullable().optional(),
  stressCurrent: z.number().int().nullable().optional(),
  visibility: z.enum(["active", "hidden", "escaped", "defeated"]).optional(),
  conditions: z.array(z.string().min(1)).optional(),
  toggleConditionId: z.string().min(1).optional(),
  gmNotes: z.string().max(4000).nullable().optional(),
  waveLabel: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function parseInstanceId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid adversary instance id");
  }
  return id;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
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
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const routeParams = await params;
    const campaignId = parseCampaignId(routeParams.id);
    const instanceId = parseInstanceId(routeParams.instanceId);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can update GM HUD adversaries." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = patchAdversaryInstanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existingRow, error: existingError } = await supabaseAdmin
      .from("campaign_hud_adversary_instances")
      .select("*")
      .eq("id", instanceId)
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
    if (!existingRow) {
      return NextResponse.json({ error: "Adversary instance not found." }, { status: 404 });
    }

    const payload = parsed.data;
    let nextConditions =
      payload.conditions ??
      parseStringArray(existingRow.conditions);
    if (payload.toggleConditionId) {
      nextConditions = toggleCondition(nextConditions, payload.toggleConditionId);
    }

    const updateRow = {
      display_name:
        payload.displayName !== undefined ? payload.displayName : existingRow.display_name,
      hp_current:
        payload.hpCurrent !== undefined ? payload.hpCurrent : existingRow.hp_current,
      stress_current:
        payload.stressCurrent !== undefined ? payload.stressCurrent : existingRow.stress_current,
      visibility:
        payload.visibility !== undefined ? payload.visibility : existingRow.visibility,
      conditions: nextConditions,
      gm_notes: payload.gmNotes !== undefined ? payload.gmNotes : existingRow.gm_notes,
      wave_label:
        payload.waveLabel !== undefined ? payload.waveLabel : existingRow.wave_label,
      sort_order:
        payload.sortOrder !== undefined ? payload.sortOrder : existingRow.sort_order,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("campaign_hud_adversary_instances")
      .update(updateRow)
      .eq("id", instanceId)
      .eq("campaign_id", campaignId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update adversary instance" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const routeParams = await params;
    const campaignId = parseCampaignId(routeParams.id);
    const instanceId = parseInstanceId(routeParams.instanceId);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can remove GM HUD adversaries." },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("campaign_hud_adversary_instances")
      .delete()
      .eq("id", instanceId)
      .eq("campaign_id", campaignId);
    if (error) {
      if (tableMissingError(error)) {
        return NextResponse.json(
          { error: "HUD runtime schema is missing. Apply schema.sql first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove adversary instance" },
      { status: 500 }
    );
  }
}
