import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  ensureInventoryBackfill,
  resolveCharacterEquipment,
} from "@/lib/character-inventory";
import {
  parseCampaignDescription,
  resolveCampaignHomebrew,
  resolveCharacterSheetCustomization,
} from "@/lib/campaign-metadata";
import {
  characterUpdateSchema,
  mapCharacterRow,
  toCharacterUpdate,
} from "@/lib/characters";
import type { DomainCardDefinition } from "@/lib/constants/domains";
import { validateDomainCardSelection } from "@/lib/domain-gating";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid character id");
  }
  return id;
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
  return data;
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = parseId((await params).id);

    const character = await requireOwnedCharacter(id, appUser.id);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const mapped = mapCharacterRow(character);
    const resolved = await resolveCharacterEquipment(mapped);
    return NextResponse.json(resolved);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch character" },
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
    const id = parseId((await params).id);

    const character = await requireOwnedCharacter(id, appUser.id);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = characterUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const sanitizedPayload = {
      ...payload,
      primaryWeaponId: undefined,
      secondaryWeaponId: undefined,
      armorId: undefined,
      inventoryItems: undefined,
    };

    let settings;
    let homebrewDomainCards: DomainCardDefinition[] = [];
    const nextCampaignId = payload.campaignId ?? Number(character.campaign_id);
    if (Number.isInteger(nextCampaignId) && nextCampaignId > 0) {
      const campaign = await canAccessCampaign(nextCampaignId, appUser.id);
      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      const parsedDescription = parseCampaignDescription(campaign.description);
      settings = resolveCharacterSheetCustomization(parsedDescription.metadata);
      homebrewDomainCards = resolveCampaignHomebrew(parsedDescription.metadata).domainCards;
    }

    if (settings) {
      const currentCharacter = mapCharacterRow(character);
      const nextClass = sanitizedPayload.class?.trim() || currentCharacter.class;
      const nextDomainCards = sanitizedPayload.domainCards ?? currentCharacter.domainCards;

      const validation = validateDomainCardSelection({
        classId: nextClass,
        domainCardIds: nextDomainCards,
        customCards: homebrewDomainCards,
        disableClassDomainGating: settings.characterRules.disableClassDomainGating,
        expandedDomainsByClass: settings.characterRules.expandedDomainsByClass,
      });

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    const updateRow = toCharacterUpdate(character, sanitizedPayload, settings);
    const { data, error } = await supabaseAdmin
      .from("characters")
      .update({
        ...updateRow,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", appUser.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update character" },
        { status: 500 }
      );
    }

    const mapped = mapCharacterRow(data);
    await ensureInventoryBackfill(mapped);
    const resolved = await resolveCharacterEquipment(mapped);
    return NextResponse.json(resolved);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update character" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = parseId((await params).id);

    const character = await requireOwnedCharacter(id, appUser.id);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("characters")
      .delete()
      .eq("id", id)
      .eq("user_id", appUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete character" },
      { status: 500 }
    );
  }
}
