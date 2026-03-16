import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { archiveCampaignInstall } from "@/lib/content/install";
import { getOwnedCampaign } from "@/lib/homebrew-api";

function parseCampaignId(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid campaign id");
  }
  return Math.round(parsed);
}

type RouteParams = {
  campaignId: string;
  installId: string;
};

export async function DELETE(
  _request: NextRequest,
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

    const archivedInstall = await archiveCampaignInstall({
      campaignId,
      installId: resolvedParams.installId,
      archivedByUserId: appUser.id,
    });

    if (!archivedInstall) {
      return NextResponse.json({ error: "Install not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, install: archivedInstall });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to archive install",
      },
      { status: 500 }
    );
  }
}
