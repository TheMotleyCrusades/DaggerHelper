import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  createCampaignInstallSuggestion,
  listCampaignInstallSuggestions,
} from "@/lib/content/install";
import { getAccessibleCampaign } from "@/lib/homebrew-api";

const suggestionInputSchema = z.object({
  productId: z.string().uuid(),
  productVersionId: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).optional(),
});

function parseCampaignId(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid campaign id");
  }
  return Math.round(parsed);
}

type RouteParams = { campaignId: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseCampaignId((await params).campaignId);
    const campaign = await getAccessibleCampaign(campaignId, appUser.id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const suggestions = await listCampaignInstallSuggestions(campaignId);
    return NextResponse.json(suggestions);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch suggestions",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseCampaignId((await params).campaignId);
    const campaign = await getAccessibleCampaign(campaignId, appUser.id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = suggestionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await createCampaignInstallSuggestion({
      campaignId,
      suggestedByUserId: appUser.id,
      productId: parsed.data.productId,
      productVersionId: parsed.data.productVersionId,
      note: parsed.data.note,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create suggestion",
      },
      { status: 500 }
    );
  }
}
