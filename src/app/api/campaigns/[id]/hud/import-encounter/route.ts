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

const importEncounterSchema = z.object({
  encounterId: z.number().int().positive(),
  mode: z.enum(["replace", "merge"]).default("replace"),
});

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
        { error: "Only the campaign owner can import encounters into the GM HUD." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = importEncounterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const { data: encounter, error: encounterError } = await supabaseAdmin
      .from("encounters")
      .select("id,campaign_id,name")
      .eq("id", payload.encounterId)
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (encounterError) {
      return NextResponse.json({ error: encounterError.message }, { status: 500 });
    }
    if (!encounter) {
      return NextResponse.json({ error: "Encounter not found for this campaign." }, { status: 404 });
    }

    const { data: links, error: linkError } = await supabaseAdmin
      .from("encounter_adversaries")
      .select("adversary_id,quantity")
      .eq("encounter_id", payload.encounterId);

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const adversaryIds = Array.from(
      new Set(
        ((links ?? []) as Array<{ adversary_id: number; quantity: number }>).map((link) =>
          Number(link.adversary_id)
        )
      )
    ).filter((id) => Number.isInteger(id) && id > 0);

    const adversaryById = new Map<number, Record<string, unknown>>();
    if (adversaryIds.length) {
      const { data: adversaries, error: adversaryError } = await supabaseAdmin
        .from("adversaries")
        .select("*")
        .in("id", adversaryIds);
      if (adversaryError) {
        return NextResponse.json({ error: adversaryError.message }, { status: 500 });
      }
      for (const row of (adversaries ?? []) as Array<Record<string, unknown>>) {
        adversaryById.set(Number(row.id), row);
      }
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

    if (payload.mode === "replace") {
      const { error: clearError } = await supabaseAdmin
        .from("campaign_hud_adversary_instances")
        .delete()
        .eq("campaign_id", campaignId);
      if (clearError) {
        if (tableMissingError(clearError)) {
          return NextResponse.json(
            { error: "HUD runtime schema is missing. Apply schema.sql first." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: clearError.message }, { status: 500 });
      }
    }

    let nextSortOrder = payload.mode === "replace" ? 0 : Number(existingRows?.[0]?.sort_order ?? 0);
    const inserts: Array<Record<string, unknown>> = [];
    for (const link of (links ?? []) as Array<{ adversary_id: number; quantity: number }>) {
      const adversary = adversaryById.get(Number(link.adversary_id));
      const baseName =
        typeof adversary?.name === "string" && adversary.name.trim().length
          ? adversary.name.trim()
          : `Adversary ${link.adversary_id}`;
      const quantity = Math.max(1, Number(link.quantity ?? 1));
      const hpCurrent = parseAdversaryStatNumber(adversary?.hp);
      const stressCurrent = parseAdversaryStatNumber(adversary?.stress);

      for (let index = 0; index < quantity; index += 1) {
        nextSortOrder += 1;
        inserts.push({
          campaign_id: campaignId,
          adversary_id: link.adversary_id,
          source_encounter_id: payload.encounterId,
          display_name: quantity > 1 ? `${baseName} ${index + 1}` : baseName,
          hp_current: hpCurrent,
          stress_current: stressCurrent,
          conditions: [],
          visibility: "active",
          sort_order: nextSortOrder,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("campaign_hud_adversary_instances")
        .insert(inserts);

      if (insertError) {
        if (tableMissingError(insertError)) {
          return NextResponse.json(
            { error: "HUD runtime schema is missing. Apply schema.sql first." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const { error: hudStateError } = await supabaseAdmin
      .from("campaign_hud_states")
      .upsert(
        {
          campaign_id: campaignId,
          source_encounter_id: payload.encounterId,
          encounter_name: encounter.name,
          status: "active",
          updated_by_user_id: appUser.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id" }
      );
    if (hudStateError && !tableMissingError(hudStateError)) {
      return NextResponse.json({ error: hudStateError.message }, { status: 500 });
    }

    const snapshot = await loadHudSnapshot(context);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import encounter" },
      { status: 500 }
    );
  }
}
