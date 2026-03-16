import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  detectLineageCollisions,
  installProductVersionToCampaign,
  listCampaignInstalls,
} from "@/lib/content/install";
import { getAccessibleCampaign, getOwnedCampaign } from "@/lib/homebrew-api";

const installInputSchema = z.object({
  productId: z.string().uuid(),
  productVersionId: z.string().uuid(),
  confirmOverwrite: z.boolean().default(false),
  source: z.string().max(120).optional(),
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

    const installs = await listCampaignInstalls(campaignId);
    return NextResponse.json(installs);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch installs" },
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
    const ownedCampaign = await getOwnedCampaign(campaignId, appUser.id);
    if (!ownedCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = installInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const collisions = await detectLineageCollisions({
      campaignId,
      productId: parsed.data.productId,
      productVersionId: parsed.data.productVersionId,
    });
    if (collisions.length && !parsed.data.confirmOverwrite) {
      return NextResponse.json(
        {
          error: "Installing this version will overwrite one or more lineage winners.",
          requiresConfirmation: true,
          collisions,
        },
        { status: 409 }
      );
    }

    const installed = await installProductVersionToCampaign({
      campaignId,
      productId: parsed.data.productId,
      productVersionId: parsed.data.productVersionId,
      installedByUserId: appUser.id,
      source: parsed.data.source,
    });
    return NextResponse.json(installed, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to install content" },
      { status: 500 }
    );
  }
}
