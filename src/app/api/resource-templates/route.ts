import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import { createBuilderEntityId } from "@/lib/campaign-metadata";
import { resourceDefinitionSchema } from "@/lib/characters";
import {
  getAccessibleCampaign,
  getOwnedCampaign,
  parseCampaignHomebrewContext,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

const resourceTemplateInputSchema = resourceDefinitionSchema.omit({ id: true }).extend({
  campaignId: z.number().int().positive().optional(),
});

function toNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const campaignId = toNumber(request.nextUrl.searchParams.get("campaignId"), 0);
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

    if (campaignId <= 0) {
      return NextResponse.json([]);
    }

    const authUser = await getSessionUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const appUser = await getOrCreateAppUser(authUser);
    const campaign = await getAccessibleCampaign(campaignId, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const context = parseCampaignHomebrewContext(campaign.description);
    let resources = context.homebrew.resourceTemplates.map((resource) => ({
      ...resource,
      campaignId,
      isOfficial: false,
    }));
    if (search) {
      resources = resources.filter((resource) => {
        return (
          resource.id.toLowerCase().includes(search) ||
          resource.label.toLowerCase().includes(search)
        );
      });
    }

    return NextResponse.json(resources);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch resource templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsedBody = resourceTemplateInputSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const payload = parsedBody.data;
    if (!payload.campaignId) {
      return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
    }

    const campaign = await getOwnedCampaign(payload.campaignId, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const context = parseCampaignHomebrewContext(campaign.description);
    const resourceTemplate = {
      id: createBuilderEntityId("resource-template"),
      label: payload.label.trim(),
      defaultCurrent: payload.defaultCurrent,
      defaultMax: payload.defaultMax,
      min: payload.min,
      max: payload.max,
      format: payload.format,
      playerEditable: payload.playerEditable,
      allowPermanentShift: payload.allowPermanentShift,
      allowTemporaryModifiers: payload.allowTemporaryModifiers,
      visibleOn: payload.visibleOn,
    };

    await persistCampaignHomebrew(
      payload.campaignId,
      appUser.id,
      context.notes,
      context.metadata,
      {
        ...context.homebrew,
        resourceTemplates: [...context.homebrew.resourceTemplates, resourceTemplate],
      }
    );

    return NextResponse.json(
      {
        ...resourceTemplate,
        campaignId: payload.campaignId,
        isOfficial: false,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create resource template" },
      { status: 500 }
    );
  }
}
