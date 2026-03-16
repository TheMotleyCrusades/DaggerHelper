import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import {
  normalizeCampaignMetadata,
  parseCampaignDescription,
  removeById,
  resolveCampaignHomebrew,
  serializeCampaignDescription,
  upsertById,
} from "@/lib/campaign-metadata";
import { domainCardInputSchema } from "@/lib/characters";
import type { DomainCardDefinition } from "@/lib/constants/domains";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid domain card id");
  }
  return id;
}

async function findOwnedCampaignCard(cardId: string, ownerId: number) {
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,description")
    .eq("user_id", ownerId);

  if (error) {
    throw new Error(error.message);
  }

  for (const campaign of campaigns ?? []) {
    const parsed = parseCampaignDescription(campaign.description);
    const normalized = normalizeCampaignMetadata(parsed.metadata);
    const homebrew = resolveCampaignHomebrew(normalized);
    const card = homebrew.domainCards.find((item) => item.id === cardId);
    if (!card) continue;

    return {
      campaignId: Number(campaign.id),
      notes: parsed.notes,
      metadata: normalized,
      homebrew,
      card,
    };
  }

  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();

    const cardId = parseId((await params).id);
    const body = await request.json();
    const parsedBody = domainCardInputSchema.partial().safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const found = await findOwnedCampaignCard(cardId, appUser.id);
    if (!found) {
      return NextResponse.json({ error: "Domain card not found" }, { status: 404 });
    }

    const patch = parsedBody.data;
    const current = found.card;
    const updatedCard: DomainCardDefinition = {
      ...current,
      name: patch.name?.trim() || current.name,
      class: patch.class?.trim().toLowerCase() || current.class,
      tier: patch.tier ?? current.tier,
      description: patch.description ?? current.description,
      traitBonuses: patch.traitBonuses ?? current.traitBonuses,
      evasion: patch.evasion ?? current.evasion,
      moveAbility: patch.moveAbility ?? current.moveAbility,
      fragileText: patch.fragileText ?? current.fragileText,
      featureText: patch.featureText ?? current.featureText,
      imageUrl: patch.imageUrl ?? current.imageUrl,
      colorScheme:
        (patch.colorScheme as DomainCardDefinition["colorScheme"] | undefined) ??
        current.colorScheme,
      campaignId: found.campaignId,
      isOfficial: false,
    };

    const nextDomainCards = upsertById(found.homebrew.domainCards, updatedCard);
    const description = serializeCampaignDescription(found.notes, {
      ...found.metadata,
      homebrew: {
        ...found.homebrew,
        domainCards: nextDomainCards,
      },
    });

    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", found.campaignId)
      .eq("user_id", appUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedCard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update domain card" },
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
    const cardId = parseId((await params).id);

    const found = await findOwnedCampaignCard(cardId, appUser.id);
    if (!found) {
      return NextResponse.json({ error: "Domain card not found" }, { status: 404 });
    }

    const description = serializeCampaignDescription(found.notes, {
      ...found.metadata,
      homebrew: {
        ...found.homebrew,
        domainCards: removeById(found.homebrew.domainCards, cardId),
      },
    });

    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({
        description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", found.campaignId)
      .eq("user_id", appUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete domain card" },
      { status: 500 }
    );
  }
}
