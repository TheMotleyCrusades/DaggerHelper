import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  loadHudSnapshot,
  parseAdversaryStatNumber,
  parseCampaignId,
  requireHudOwnerContext,
} from "@/lib/hud";
import { tableMissingError } from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const addAdversarySchema = z.object({
  adversaryId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
  displayName: z.string().max(140).optional(),
  waveLabel: z.string().max(120).nullable().optional(),
});

function canUseAdversary(
  row: Record<string, unknown>,
  campaignId: number,
  ownerUserId: number
) {
  return (
    Number(row.user_id) === ownerUserId ||
    Number(row.campaign_id) === campaignId ||
    Boolean(row.is_public)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseCampaignId((await params).id);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can add adversaries in the GM HUD." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = addAdversarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const { data: adversaryRow, error: adversaryError } = await supabaseAdmin
      .from("adversaries")
      .select("*")
      .eq("id", payload.adversaryId)
      .maybeSingle();
    if (adversaryError) {
      return NextResponse.json({ error: adversaryError.message }, { status: 500 });
    }
    if (!adversaryRow || !canUseAdversary(adversaryRow, campaignId, appUser.id)) {
      return NextResponse.json({ error: "Adversary not available for this campaign HUD." }, { status: 404 });
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("campaign_hud_adversary_instances")
      .select("sort_order")
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (existingError && !tableMissingError(existingError)) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    let nextSortOrder = Number(existingRows?.[0]?.sort_order ?? 0);
    const baseName =
      payload.displayName?.trim() ||
      (typeof adversaryRow.name === "string" && adversaryRow.name.trim().length
        ? adversaryRow.name.trim()
        : `Adversary ${payload.adversaryId}`);
    const hpCurrent = parseAdversaryStatNumber(adversaryRow.hp);
    const stressCurrent = parseAdversaryStatNumber(adversaryRow.stress);
    const rows: Array<Record<string, unknown>> = [];
    for (let index = 0; index < payload.quantity; index += 1) {
      nextSortOrder += 1;
      rows.push({
        campaign_id: campaignId,
        adversary_id: payload.adversaryId,
        source_encounter_id: null,
        display_name:
          payload.quantity > 1 ? `${baseName} ${index + 1}` : baseName,
        hp_current: hpCurrent,
        stress_current: stressCurrent,
        conditions: [],
        gm_notes: null,
        visibility: "active",
        wave_label: payload.waveLabel ?? null,
        sort_order: nextSortOrder,
        updated_at: new Date().toISOString(),
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("campaign_hud_adversary_instances")
      .insert(rows);
    if (insertError) {
      if (tableMissingError(insertError)) {
        return NextResponse.json(
          { error: "HUD runtime schema is missing. Apply schema.sql first." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add adversary" },
      { status: 500 }
    );
  }
}
