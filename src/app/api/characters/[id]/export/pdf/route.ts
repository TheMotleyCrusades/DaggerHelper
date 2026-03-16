import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { resolveCharacterEquipment } from "@/lib/character-inventory";
import {
  parseCampaignDescription,
  resolveCharacterSheetCustomization,
} from "@/lib/campaign-metadata";
import { mapCharacterRow } from "@/lib/characters";
import { createCharacterSheetPdf } from "@/lib/pdf/characterSheet";
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
    let pdfConfig: Parameters<typeof createCharacterSheetPdf>[1] | undefined;
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
        pdfConfig = {
          resources: settings.resources.filter((resource) => resource.visibleOn.pdf),
          currency: settings.currency,
          labels: settings.importExport.applyLabelsToPdf ? settings.labels : undefined,
          layout: {
            ...settings.layout,
            sections: settings.layout.sections.filter((section) => section.showOnPdf),
          },
          conditions: settings.conditions.filter((condition) => condition.visibleToPlayers),
          customFields: settings.displaySettings.customFields,
          characterRules: settings.characterRules,
          craftingRules: settings.craftingRules,
          druidFormRules: settings.druidFormRules,
          companionRules: settings.companionRules,
        };

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

    const pdfBytes = await createCharacterSheetPdf(character, pdfConfig);

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="character-${characterId}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export character PDF" },
      { status: 500 }
    );
  }
}
