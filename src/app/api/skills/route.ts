import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAppUser, getSessionUser, requireAppUser } from "@/lib/auth";
import { createBuilderEntityId } from "@/lib/campaign-metadata";
import { TRAIT_KEYS } from "@/lib/constants/classes";
import {
  getAccessibleCampaign,
  getOwnedCampaign,
  parseCampaignHomebrewContext,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

const skillInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  label: z.string().min(1).max(120),
  helperText: z.string().max(300).default(""),
  traits: z.array(z.enum(TRAIT_KEYS)).min(1),
});

function toNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function normalizeTraits(traits: string[]) {
  return Array.from(new Set(traits.map((trait) => trait.trim().toLowerCase()).filter(Boolean)));
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
    let skills = context.homebrew.skills.map((skill) => ({
      ...skill,
      campaignId,
      isOfficial: false,
    }));
    if (search) {
      skills = skills.filter((skill) => {
        return (
          skill.label.toLowerCase().includes(search) ||
          skill.helperText.toLowerCase().includes(search) ||
          skill.traits.some((trait) => trait.toLowerCase().includes(search))
        );
      });
    }

    return NextResponse.json(skills);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch skills" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsedBody = skillInputSchema.safeParse(body);
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
    const skill = {
      id: createBuilderEntityId("skill"),
      label: payload.label.trim(),
      helperText: payload.helperText.trim(),
      traits: normalizeTraits(payload.traits),
    };

    await persistCampaignHomebrew(
      payload.campaignId,
      appUser.id,
      context.notes,
      context.metadata,
      {
        ...context.homebrew,
        skills: [...context.homebrew.skills, skill],
      }
    );

    return NextResponse.json(
      {
        ...skill,
        campaignId: payload.campaignId,
        isOfficial: false,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create skill" },
      { status: 500 }
    );
  }
}
