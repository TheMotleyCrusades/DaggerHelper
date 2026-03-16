import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  calculateBaseBudget,
  calculateEncounterCost,
  classifyDifficulty,
  encounterCreateSchema,
  mapEncounterRow,
} from "@/lib/encounters";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function getAccessibleCampaignIds(userId: number) {
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("user_id", userId);

  if (ownedError) throw new Error(ownedError.message);

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("campaign_members")
    .select("campaign_id")
    .eq("user_id", userId);

  if (membershipError) throw new Error(membershipError.message);

  const ids = new Set<number>();
  for (const row of (owned ?? []) as Array<{ id: number }>) ids.add(row.id);
  for (const row of (memberships ?? []) as Array<{ campaign_id: number }>) ids.add(row.campaign_id);
  return [...ids];
}

async function calculateEncounterDifficultyFromAdversaries(
  selected: Array<{ adversaryId: number; quantity: number }>,
  partySize: number,
  adjustment: number
) {
  if (!selected.length) {
    return {
      spent: 0,
      budget: calculateBaseBudget(partySize) + adjustment,
      difficulty: "easy",
    };
  }

  const ids = selected.map((item) => item.adversaryId);
  const { data: adversaries, error } = await supabaseAdmin
    .from("adversaries")
    .select("id,type")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  const typeById = new Map<number, string>();
  for (const row of (adversaries ?? []) as Array<{ id: number; type: string }>) {
    typeById.set(row.id, row.type);
  }

  const encounterRoles = selected.map((item) => ({
    type: typeById.get(item.adversaryId) ?? "standard",
    quantity: item.quantity,
  }));

  const spent = calculateEncounterCost(encounterRoles);
  const budget = calculateBaseBudget(partySize) + adjustment;
  return {
    spent,
    budget,
    difficulty: classifyDifficulty(spent, budget),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const campaignIdParam = request.nextUrl.searchParams.get("campaignId");
    const accessibleCampaignIds = await getAccessibleCampaignIds(appUser.id);
    if (!accessibleCampaignIds.length) return NextResponse.json([]);

    let query = supabaseAdmin
      .from("encounters")
      .select("*")
      .in("campaign_id", accessibleCampaignIds)
      .order("updated_at", { ascending: false });

    if (campaignIdParam) {
      const campaignId = Number(campaignIdParam);
      if (!Number.isInteger(campaignId) || !accessibleCampaignIds.includes(campaignId)) {
        return NextResponse.json({ error: "Forbidden campaign access" }, { status: 403 });
      }
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const encounterIds = rows.map((row) => Number(row.id));

    const countsByEncounter = new Map<number, number>();
    if (encounterIds.length) {
      const { data: links } = await supabaseAdmin
        .from("encounter_adversaries")
        .select("encounter_id,quantity")
        .in("encounter_id", encounterIds);

      for (const link of (links ?? []) as Array<{ encounter_id: number; quantity: number }>) {
        countsByEncounter.set(
          link.encounter_id,
          (countsByEncounter.get(link.encounter_id) ?? 0) + Number(link.quantity ?? 1)
        );
      }
    }

    return NextResponse.json(
      rows.map((row) => ({
        ...mapEncounterRow(row),
        adversaryCount: countsByEncounter.get(Number(row.id)) ?? 0,
      }))
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch encounters" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = encounterCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const accessibleCampaignIds = await getAccessibleCampaignIds(appUser.id);
    if (!accessibleCampaignIds.includes(data.campaignId)) {
      return NextResponse.json({ error: "Forbidden campaign access" }, { status: 403 });
    }

    const analysis = await calculateEncounterDifficultyFromAdversaries(
      data.adversaries,
      data.partySize,
      data.difficultyAdjustment
    );

    const { data: inserted, error } = await supabaseAdmin
      .from("encounters")
      .insert({
        campaign_id: data.campaignId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        difficulty: analysis.difficulty,
      })
      .select("*")
      .single();

    if (error || !inserted) {
      return NextResponse.json({ error: error?.message ?? "Failed to create encounter" }, { status: 500 });
    }

    if (data.adversaries.length) {
      const records = data.adversaries.map((item) => ({
        encounter_id: inserted.id,
        adversary_id: item.adversaryId,
        quantity: item.quantity,
      }));

      const { error: linkError } = await supabaseAdmin
        .from("encounter_adversaries")
        .insert(records);

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        ...mapEncounterRow(inserted as Record<string, unknown>),
        budget: analysis.budget,
        spent: analysis.spent,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create encounter" }, { status: 500 });
  }
}
