import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  ensureInventoryBackfill,
  resolveCharacterEquipment,
  resolveCharactersEquipment,
} from "@/lib/character-inventory";
import {
  parseCampaignDescription,
  resolveCampaignHomebrew,
  resolveCharacterSheetCustomization,
} from "@/lib/campaign-metadata";
import {
  characterInputSchema,
  mapCharacterRow,
  toCharacterInsert,
} from "@/lib/characters";
import { validateDomainCardSelection } from "@/lib/domain-gating";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseCampaignId(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

async function canAccessCampaign(campaignId: number, userId: number) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id,description")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(campaignError.message);
  }
  if (!campaign) return null;

  if (campaign.user_id === userId) return campaign;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  return member ? campaign : null;
}

export async function GET(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();

    const campaignId = parseCampaignId(request.nextUrl.searchParams.get("campaignId"));
    let query = supabaseAdmin
      .from("characters")
      .select("*")
      .eq("user_id", appUser.id)
      .order("updated_at", { ascending: false });

    if (campaignId && campaignId > 0) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const mapped = rows.map((row) => mapCharacterRow(row));
    const resolved = await resolveCharactersEquipment(mapped);
    return NextResponse.json(resolved);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch characters" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();

    const body = await request.json();
    const parsed = characterInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const campaign = await canAccessCampaign(payload.campaignId, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaignDescription = parseCampaignDescription(campaign.description);
    const settings = resolveCharacterSheetCustomization(campaignDescription.metadata);
    const homebrew = resolveCampaignHomebrew(campaignDescription.metadata);

    const validation = validateDomainCardSelection({
      classId: payload.class,
      domainCardIds: payload.domainCards,
      customCards: homebrew.domainCards,
      disableClassDomainGating: settings.characterRules.disableClassDomainGating,
      expandedDomainsByClass: settings.characterRules.expandedDomainsByClass,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const row = toCharacterInsert(payload, settings);

    const { data, error } = await supabaseAdmin
      .from("characters")
      .insert({
        ...row,
        user_id: appUser.id,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create character" },
        { status: 500 }
      );
    }

    const mapped = mapCharacterRow(data);
    await ensureInventoryBackfill(mapped);
    const resolved = await resolveCharacterEquipment(mapped);
    return NextResponse.json(resolved, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create character" },
      { status: 500 }
    );
  }
}
