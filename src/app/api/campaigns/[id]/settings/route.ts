import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  normalizeCampaignMetadata,
  parseCampaignDescription,
  resolveCharacterSheetCustomization,
  serializeCampaignDescription,
} from "@/lib/campaign-metadata";
import { campaignSettingsSchema } from "@/lib/characters";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid campaign id");
  }
  return id;
}

async function getOwnedCampaign(campaignId: number, ownerId: number) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id,description")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.user_id !== ownerId) {
    return null;
  }

  return data;
}

async function getAccessibleCampaign(campaignId: number, userId: number) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id,description")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(campaignError.message);
  }
  if (!campaign) {
    return null;
  }
  if (campaign.user_id === userId) {
    return campaign;
  }

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

function settingsResponse(campaignId: number, description: unknown) {
  const parsed = parseCampaignDescription(description);
  const settings = resolveCharacterSheetCustomization(parsed.metadata);

  return {
    id: campaignId,
    baseHp: settings.baseHp,
    baseStress: settings.baseStress,
    baseHope: settings.baseHope,
    maxDomainCards: settings.maxDomainCards,
    experiencesPerLevel: settings.experiencesPerLevel,
    startingEquipmentByClass: settings.startingEquipmentByClass,
    resources: settings.resources,
    currency: settings.currency,
    labels: settings.labels,
    layout: settings.layout,
    skills: settings.skills,
    characterRules: settings.characterRules,
    conditions: settings.conditions,
    importExport: settings.importExport,
    craftingRules: settings.craftingRules,
    druidFormRules: settings.druidFormRules,
    companionRules: settings.companionRules,
    showGold: settings.displaySettings.showGold,
    showInventory: settings.displaySettings.showInventory,
    showConnections: settings.displaySettings.showConnections,
    customFields: settings.displaySettings.customFields,
    domainCardTemplate: settings.domainCardTemplate,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = parseId((await params).id);
    const campaign = await getAccessibleCampaign(id, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(settingsResponse(id, campaign.description));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaign settings" },
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
    const campaign = await getOwnedCampaign(id, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsedBody = campaignSettingsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const existing = parseCampaignDescription(campaign.description);
    const current = resolveCharacterSheetCustomization(existing.metadata);
    const patch = parsedBody.data;
    const nextStartingEquipmentByClass =
      patch.startingEquipmentByClass ??
      patch.characterRules?.startingEquipmentByClass ??
      current.startingEquipmentByClass;

    const nextSettings = {
      ...current,
      baseHp: patch.baseHp ?? current.baseHp,
      baseStress: patch.baseStress ?? current.baseStress,
      baseHope: patch.baseHope ?? current.baseHope,
      maxDomainCards: patch.maxDomainCards ?? current.maxDomainCards,
      experiencesPerLevel: patch.experiencesPerLevel ?? current.experiencesPerLevel,
      startingEquipmentByClass: nextStartingEquipmentByClass,
      resources: patch.resources ?? current.resources,
      currency: patch.currency ?? current.currency,
      labels: patch.labels ?? current.labels,
      layout: patch.layout ?? current.layout,
      skills: patch.skills ?? current.skills,
      characterRules: patch.characterRules
        ? {
            ...patch.characterRules,
            startingEquipmentByClass:
              patch.characterRules.startingEquipmentByClass ?? nextStartingEquipmentByClass,
          }
        : {
            ...current.characterRules,
            startingEquipmentByClass: nextStartingEquipmentByClass,
          },
      conditions: patch.conditions ?? current.conditions,
      importExport: patch.importExport ?? current.importExport,
      craftingRules: patch.craftingRules ?? current.craftingRules,
      druidFormRules: patch.druidFormRules ?? current.druidFormRules,
      companionRules: patch.companionRules ?? current.companionRules,
      displaySettings: {
        ...current.displaySettings,
        showGold: patch.showGold ?? current.displaySettings.showGold,
        showInventory: patch.showInventory ?? current.displaySettings.showInventory,
        showConnections: patch.showConnections ?? current.displaySettings.showConnections,
        customFields: patch.customFields ?? current.displaySettings.customFields,
      },
      domainCardTemplate:
        patch.domainCardTemplate === undefined
          ? current.domainCardTemplate
          : (patch.domainCardTemplate as typeof current.domainCardTemplate),
    };

    const mergedMetadata = normalizeCampaignMetadata({
      ...existing.metadata,
      settings: nextSettings,
    });

    const description = serializeCampaignDescription(existing.notes, mergedMetadata);

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update({
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", appUser.id)
      .select("id,description")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(settingsResponse(id, data.description));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update campaign settings" },
      { status: 500 }
    );
  }
}
