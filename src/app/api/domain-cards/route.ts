import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getOrCreateAppUser, requireAppUser } from "@/lib/auth";
import {
  createBuilderEntityId,
  normalizeCampaignMetadata,
  parseCampaignDescription,
  resolveCampaignHomebrew,
  resolveCharacterSheetCustomization,
  serializeCampaignDescription,
} from "@/lib/campaign-metadata";
import { domainCardInputSchema } from "@/lib/characters";
import {
  OFFICIAL_DOMAIN_CARDS,
  normalizeDomainKey,
  resolveAllowedDomainsForClass,
  type DomainCardDefinition,
} from "@/lib/constants/domains";
import { supabaseAdmin } from "@/lib/supabase/admin";

function toNumber(value: string | null, fallback = 0) {
  const number = value ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? Math.round(number) : fallback;
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
    const params = request.nextUrl.searchParams;
    const campaignId = toNumber(params.get("campaignId"), 0);
    const className = params.get("class")?.trim().toLowerCase() ?? "";
    const tier = toNumber(params.get("tier"));
    const search = params.get("search")?.trim().toLowerCase() ?? "";

    let customCards: DomainCardDefinition[] = [];
    let disableClassDomainGating = false;
    let expandedDomainsByClass: Record<string, string[]> = {};
    if (campaignId > 0) {
      const authUser = await getSessionUser();
      if (!authUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const appUser = await getOrCreateAppUser(authUser);
      const campaign = await canAccessCampaign(campaignId, appUser.id);
      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }

      const parsed = parseCampaignDescription(campaign.description);
      const settings = resolveCharacterSheetCustomization(parsed.metadata);
      customCards = resolveCampaignHomebrew(parsed.metadata).domainCards;
      disableClassDomainGating = settings.characterRules.disableClassDomainGating;
      expandedDomainsByClass = settings.characterRules.expandedDomainsByClass;
    }

    let cards = [...OFFICIAL_DOMAIN_CARDS, ...customCards];

    if (className) {
      if (!disableClassDomainGating) {
        const allowedDomains = resolveAllowedDomainsForClass(className, {
          disableClassDomainGating,
          expandedDomainsByClass,
        });

        cards = cards.filter((card) => {
          if (card.isOfficial && card.domain) {
            if (!allowedDomains) return true;
            return allowedDomains.includes(normalizeDomainKey(card.domain));
          }

          return card.class.toLowerCase() === className;
        });
      }
    }
    if (tier > 0) {
      cards = cards.filter((card) => card.tier === tier);
    }
    if (search) {
      cards = cards.filter((card) => {
        return (
          card.name.toLowerCase().includes(search) ||
          card.description.toLowerCase().includes(search) ||
          card.featureText.toLowerCase().includes(search) ||
          card.domain?.toLowerCase().includes(search)
        );
      });
    }

    return NextResponse.json(cards);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch domain cards" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();

    const body = await request.json();
    const parsedBody = domainCardInputSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const payload = parsedBody.data;
    if (!payload.campaignId) {
      return NextResponse.json(
        { error: "campaignId is required for custom domain cards" },
        { status: 400 }
      );
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id,user_id,description")
      .eq("id", payload.campaignId)
      .maybeSingle();

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }
    if (!campaign || campaign.user_id !== appUser.id) {
      return NextResponse.json({ error: "Only campaign GMs can create cards" }, { status: 403 });
    }

    const parsedDescription = parseCampaignDescription(campaign.description);
    const normalizedMetadata = normalizeCampaignMetadata(parsedDescription.metadata);
    const homebrew = resolveCampaignHomebrew(normalizedMetadata);

    const card = {
      id: createBuilderEntityId("domain"),
      campaignId: payload.campaignId,
      name: payload.name.trim(),
      class: payload.class.trim().toLowerCase(),
      tier: payload.tier,
      description: payload.description,
      traitBonuses: payload.traitBonuses,
      evasion: payload.evasion,
      moveAbility: payload.moveAbility,
      fragileText: payload.fragileText,
      featureText: payload.featureText,
      imageUrl: payload.imageUrl ?? null,
      colorScheme: payload.colorScheme as
        | "ember"
        | "verdant"
        | "tide"
        | "steel"
        | "arcane"
        | "dusk"
        | "default",
      isOfficial: false,
    };

    const description = serializeCampaignDescription(parsedDescription.notes, {
      ...normalizedMetadata,
      homebrew: {
        ...homebrew,
        domainCards: [...homebrew.domainCards, card],
      },
    });

    const { error: updateError } = await supabaseAdmin
      .from("campaigns")
      .update({
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.campaignId)
      .eq("user_id", appUser.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create domain card" },
      { status: 500 }
    );
  }
}
