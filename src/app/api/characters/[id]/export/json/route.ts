import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { resolveCharacterEquipment } from "@/lib/character-inventory";
import {
  parseCampaignDescription,
  resolveCharacterSheetCustomization,
} from "@/lib/campaign-metadata";
import { mapCharacterRow } from "@/lib/characters";
import {
  applyDruidFormToCombat,
  applyDruidFormToTraits,
  resolveActiveDruidForm,
} from "@/lib/optional-systems";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid character id");
  }
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const characterId = parseId((await params).id);

    const { data, error } = await supabaseAdmin
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    let character = await resolveCharacterEquipment(mapCharacterRow(data));

    let sheetConfig: {
      resources: ReturnType<typeof resolveCharacterSheetCustomization>["resources"];
      currency: ReturnType<typeof resolveCharacterSheetCustomization>["currency"];
      labels: ReturnType<typeof resolveCharacterSheetCustomization>["labels"];
      layout: ReturnType<typeof resolveCharacterSheetCustomization>["layout"];
      conditions: ReturnType<typeof resolveCharacterSheetCustomization>["conditions"];
      customFields: ReturnType<typeof resolveCharacterSheetCustomization>["displaySettings"]["customFields"];
      displaySettings: {
        showGold: boolean;
        showInventory: boolean;
        showConnections: boolean;
      };
      characterRules: ReturnType<typeof resolveCharacterSheetCustomization>["characterRules"];
      importExport: ReturnType<typeof resolveCharacterSheetCustomization>["importExport"];
      craftingRules: ReturnType<typeof resolveCharacterSheetCustomization>["craftingRules"];
      druidFormRules: ReturnType<typeof resolveCharacterSheetCustomization>["druidFormRules"];
      companionRules: ReturnType<typeof resolveCharacterSheetCustomization>["companionRules"];
    } | null = null;

    if (character.campaignId) {
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from("campaigns")
        .select("id,description")
        .eq("id", character.campaignId)
        .maybeSingle();

      if (campaignError) {
        return NextResponse.json({ error: campaignError.message }, { status: 500 });
      }

      if (campaign) {
        const parsedCampaign = parseCampaignDescription(campaign.description);
        const settings = resolveCharacterSheetCustomization(parsedCampaign.metadata);
        if (settings.importExport.includeRulesInJson) {
          sheetConfig = {
            resources: settings.resources,
            currency: settings.currency,
            labels: settings.labels,
            layout: settings.layout,
            conditions: settings.conditions,
            customFields: settings.displaySettings.customFields,
            displaySettings: {
              showGold: settings.displaySettings.showGold,
              showInventory: settings.displaySettings.showInventory,
              showConnections: settings.displaySettings.showConnections,
            },
            characterRules: settings.characterRules,
            importExport: settings.importExport,
            craftingRules: settings.craftingRules,
            druidFormRules: settings.druidFormRules,
            companionRules: settings.companionRules,
          };
        }

        const activeForm = resolveActiveDruidForm(
          character.level,
          character.class,
          character.druidFormState,
          settings.druidFormRules
        );
        if (activeForm) {
          character = {
            ...character,
            traits: applyDruidFormToTraits(character.traits, activeForm),
            resolvedCombat: applyDruidFormToCombat(
              character.resolvedCombat,
              character.baseEvasion ?? 0,
              activeForm
            ),
          };
        }
      }
    }

    const exportPayload = {
      ...character,
      exportedAt: new Date().toISOString(),
      ...(sheetConfig ? { sheetConfig } : {}),
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="character-${characterId}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export character JSON" },
      { status: 500 }
    );
  }
}
