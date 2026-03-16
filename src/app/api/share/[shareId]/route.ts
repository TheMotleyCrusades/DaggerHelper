import { NextRequest, NextResponse } from "next/server";
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
import { parseShareId } from "@/lib/share-token";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const shareId = (await params).shareId;
    const token = parseShareId(shareId);
    if (!token) {
      return NextResponse.json({ error: "Share link not found or expired" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("characters")
      .select("*")
      .eq("id", token.characterId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    let sheetConfig: {
      displaySettings: {
        showGold: boolean;
        showInventory: boolean;
        showConnections: boolean;
      };
      resources: ReturnType<typeof resolveCharacterSheetCustomization>["resources"];
      currency: ReturnType<typeof resolveCharacterSheetCustomization>["currency"];
      conditions: ReturnType<typeof resolveCharacterSheetCustomization>["conditions"];
      customFields: ReturnType<typeof resolveCharacterSheetCustomization>["displaySettings"]["customFields"];
      labels: ReturnType<typeof resolveCharacterSheetCustomization>["labels"] | undefined;
      layout: ReturnType<typeof resolveCharacterSheetCustomization>["layout"];
      characterRules: ReturnType<typeof resolveCharacterSheetCustomization>["characterRules"];
      craftingRules: ReturnType<typeof resolveCharacterSheetCustomization>["craftingRules"];
      druidFormRules: ReturnType<typeof resolveCharacterSheetCustomization>["druidFormRules"];
      companionRules: ReturnType<typeof resolveCharacterSheetCustomization>["companionRules"];
    } | null = null;

    const campaignId = Number(data.campaign_id);
    if (Number.isInteger(campaignId) && campaignId > 0) {
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from("campaigns")
        .select("id,description")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignError) {
        return NextResponse.json({ error: campaignError.message }, { status: 500 });
      }

      if (campaign) {
        const parsedCampaign = parseCampaignDescription(campaign.description);
        const settings = resolveCharacterSheetCustomization(parsedCampaign.metadata);
        sheetConfig = {
          displaySettings: {
            showGold: settings.displaySettings.showGold,
            showInventory: settings.displaySettings.showInventory,
            showConnections: settings.displaySettings.showConnections,
          },
          resources: settings.resources.filter((resource) => resource.visibleOn.share),
          currency: settings.currency,
          conditions: settings.conditions.filter((condition) => condition.visibleToPlayers),
          customFields: settings.displaySettings.customFields,
          labels: settings.importExport.applyLabelsToShare ? settings.labels : undefined,
          layout: {
            ...settings.layout,
            sections: settings.layout.sections.filter((section) => section.showOnShare),
          },
          characterRules: settings.characterRules,
          craftingRules: settings.craftingRules,
          druidFormRules: settings.druidFormRules,
          companionRules: settings.companionRules,
        };
      }
    }

    let character = await resolveCharacterEquipment(mapCharacterRow(data));
    if (sheetConfig?.druidFormRules) {
      const activeForm = resolveActiveDruidForm(
        character.level,
        character.class,
        character.druidFormState,
        sheetConfig.druidFormRules
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

    return NextResponse.json({
      shareId,
      character,
      sheetConfig,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load share" },
      { status: 500 }
    );
  }
}
