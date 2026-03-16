import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { reviewCampaignInstallSuggestion } from "@/lib/content/install";
import { getOwnedCampaign } from "@/lib/homebrew-api";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

function parseCampaignId(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid campaign id");
  }
  return Math.round(parsed);
}

type RouteParams = {
  campaignId: string;
  suggestionId: string;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const resolvedParams = await params;
    const campaignId = parseCampaignId(resolvedParams.campaignId);

    const ownedCampaign = await getOwnedCampaign(campaignId, appUser.id);
    if (!ownedCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const reviewed = await reviewCampaignInstallSuggestion({
      campaignId,
      suggestionId: resolvedParams.suggestionId,
      status: parsed.data.status,
      reviewedByUserId: appUser.id,
    });

    if (!reviewed) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    return NextResponse.json(reviewed);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to review suggestion",
      },
      { status: 500 }
    );
  }
}
