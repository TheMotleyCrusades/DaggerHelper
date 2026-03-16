import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import { createBuilderEntityId } from "@/lib/campaign-metadata";
import {
  getAccessibleCampaign,
  getOwnedCampaign,
  parseCampaignHomebrewContext,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

const conditionInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(600),
  playerToggle: z.boolean().default(true),
  visibleToPlayers: z.boolean().default(true),
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
    let conditions = context.homebrew.conditions.map((condition) => ({
      ...condition,
      campaignId,
      isOfficial: false,
    }));
    if (search) {
      conditions = conditions.filter((condition) => {
        return (
          condition.name.toLowerCase().includes(search) ||
          condition.description.toLowerCase().includes(search)
        );
      });
    }

    return NextResponse.json(conditions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch conditions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsedBody = conditionInputSchema.safeParse(body);
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
    const condition = {
      id: createBuilderEntityId("condition"),
      name: payload.name.trim(),
      description: payload.description.trim(),
      playerToggle: payload.playerToggle,
      visibleToPlayers: payload.visibleToPlayers,
    };

    await persistCampaignHomebrew(
      payload.campaignId,
      appUser.id,
      context.notes,
      context.metadata,
      {
        ...context.homebrew,
        conditions: [...context.homebrew.conditions, condition],
      }
    );

    return NextResponse.json(
      {
        ...condition,
        campaignId: payload.campaignId,
        isOfficial: false,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create condition" },
      { status: 500 }
    );
  }
}
