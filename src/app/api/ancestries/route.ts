import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import { createBuilderEntityId } from "@/lib/campaign-metadata";
import { homebrewEntityInputSchema } from "@/lib/characters";
import {
  getAccessibleCampaign,
  getOwnedCampaign,
  parseCampaignHomebrewContext,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";
import {
  toOfficialAncestryRecords,
  type HomebrewEntityRecord,
} from "@/lib/homebrew-library";

function toNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function matchesSearch(record: HomebrewEntityRecord, search: string) {
  if (!search) return true;
  return (
    record.name.toLowerCase().includes(search) ||
    record.description.toLowerCase().includes(search) ||
    record.tags.some((tag) => tag.toLowerCase().includes(search))
  );
}

export async function GET(request: NextRequest) {
  try {
    const campaignId = toNumber(request.nextUrl.searchParams.get("campaignId"), 0);
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

    let customRecords: HomebrewEntityRecord[] = [];
    if (campaignId > 0) {
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
      customRecords = context.homebrew.ancestries.map((item) => ({
        ...item,
        campaignId,
      }));
    }

    const records = [...toOfficialAncestryRecords(), ...customRecords].filter((record) =>
      matchesSearch(record, search)
    );
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch ancestries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsedBody = homebrewEntityInputSchema.safeParse(body);
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
    const record = {
      id: createBuilderEntityId("ancestry"),
      name: payload.name.trim(),
      description: payload.description.trim(),
      tags: normalizeTags(payload.tags),
      isOfficial: false,
    };

    await persistCampaignHomebrew(
      payload.campaignId,
      appUser.id,
      context.notes,
      context.metadata,
      {
        ...context.homebrew,
        ancestries: [...context.homebrew.ancestries, record],
      }
    );

    return NextResponse.json(
      {
        ...record,
        campaignId: payload.campaignId,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create ancestry" },
      { status: 500 }
    );
  }
}
