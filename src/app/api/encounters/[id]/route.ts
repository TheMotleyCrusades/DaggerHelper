import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  calculateBaseBudget,
  calculateEncounterCost,
  classifyDifficulty,
  encounterUpdateSchema,
  mapEncounterRow,
} from "@/lib/encounters";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid encounter id");
  }
  return id;
}

async function getEncounter(encounterId: number) {
  const { data, error } = await supabaseAdmin
    .from("encounters")
    .select("*")
    .eq("id", encounterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as Record<string, unknown> | null;
}

async function canAccessEncounter(encounterId: number, userId: number) {
  const encounter = await getEncounter(encounterId);
  if (!encounter) return { encounter: null, allowed: false, isOwner: false };

  const campaignId = Number(encounter.campaign_id);
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) return { encounter, allowed: false, isOwner: false };
  if (campaign.user_id === userId) return { encounter, allowed: true, isOwner: true };

  const { data: membership } = await supabaseAdmin
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  return { encounter, allowed: Boolean(membership), isOwner: false };
}

async function calculateDifficulty(
  selected: Array<{ adversaryId: number; quantity: number }>,
  partySize: number,
  adjustment: number
) {
  if (!selected.length) {
    const budget = calculateBaseBudget(partySize) + adjustment;
    return { spent: 0, budget, difficulty: "easy" };
  }

  const ids = selected.map((item) => item.adversaryId);
  const { data: adversaries, error } = await supabaseAdmin
    .from("adversaries")
    .select("id,type")
    .in("id", ids);

  if (error) throw new Error(error.message);

  const typeById = new Map<number, string>();
  for (const row of (adversaries ?? []) as Array<{ id: number; type: string }>) {
    typeById.set(row.id, row.type);
  }

  const spent = calculateEncounterCost(
    selected.map((item) => ({
      type: typeById.get(item.adversaryId) ?? "standard",
      quantity: item.quantity,
    }))
  );
  const budget = calculateBaseBudget(partySize) + adjustment;
  return { spent, budget, difficulty: classifyDifficulty(spent, budget) };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const encounterId = parseId((await params).id);
    const access = await canAccessEncounter(encounterId, appUser.id);
    if (!access.encounter || !access.allowed) {
      return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    const { data: links, error: linkError } = await supabaseAdmin
      .from("encounter_adversaries")
      .select("adversary_id,quantity")
      .eq("encounter_id", encounterId);

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const linkRows = (links ?? []) as Array<{ adversary_id: number; quantity: number }>;
    const ids = linkRows.map((link) => link.adversary_id);

    let adversariesById = new Map<number, Record<string, unknown>>();
    if (ids.length) {
      const { data: adversaries } = await supabaseAdmin
        .from("adversaries")
        .select("id,name,type,tier")
        .in("id", ids);
      adversariesById = new Map(
        ((adversaries ?? []) as Array<Record<string, unknown>>).map((row) => [Number(row.id), row])
      );
    }

    return NextResponse.json({
      ...mapEncounterRow(access.encounter),
      adversaries: linkRows.map((link) => ({
        adversaryId: link.adversary_id,
        quantity: link.quantity,
        adversary: adversariesById.get(link.adversary_id) ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch encounter" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const encounterId = parseId((await params).id);
    const access = await canAccessEncounter(encounterId, appUser.id);
    if (!access.encounter || !access.allowed) {
      return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = encounterUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    let difficulty = access.encounter.difficulty as string;
    let analysis: { spent: number; budget: number } | null = null;

    if (payload.adversaries) {
      const detail = await calculateDifficulty(
        payload.adversaries,
        payload.partySize ?? 4,
        payload.difficultyAdjustment ?? 0
      );
      difficulty = detail.difficulty;
      analysis = { spent: detail.spent, budget: detail.budget };

      await supabaseAdmin
        .from("encounter_adversaries")
        .delete()
        .eq("encounter_id", encounterId);

      if (payload.adversaries.length) {
        const records = payload.adversaries.map((item) => ({
          encounter_id: encounterId,
          adversary_id: item.adversaryId,
          quantity: item.quantity,
        }));
        await supabaseAdmin.from("encounter_adversaries").insert(records);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("encounters")
      .update({
        name: payload.name?.trim(),
        description: payload.description?.trim() || null,
        difficulty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", encounterId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to update encounter" }, { status: 500 });
    }

    return NextResponse.json({
      ...mapEncounterRow(data as Record<string, unknown>),
      ...(analysis ?? {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update encounter" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const encounterId = parseId((await params).id);
    const access = await canAccessEncounter(encounterId, appUser.id);
    if (!access.encounter || !access.allowed) {
      return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: "Only campaign GM can delete encounters" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("encounters").delete().eq("id", encounterId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to delete encounter" }, { status: 500 });
  }
}
