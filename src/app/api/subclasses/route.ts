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
import {
  extractSubclassClassId,
  normalizeClassToken,
  toOfficialSubclassRecords,
  type HomebrewSubclassRecord,
} from "@/lib/homebrew-library";

const subclassInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  tags: z.array(z.string().min(1).max(60)).default([]),
  classId: z.string().min(1).max(120),
  spellcastTrait: z.string().max(80).optional(),
});

function toNumber(value: string | null, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function mergeSubclassTags(
  baseTags: string[],
  classId: string,
  spellcastTrait?: string
) {
  const passthrough = baseTags.filter(
    (tag) => !tag.startsWith("class:") && !tag.startsWith("spellcast:")
  );
  const nextTags = [...passthrough, `class:${normalizeClassToken(classId)}`];
  if (spellcastTrait?.trim()) {
    nextTags.push(`spellcast:${spellcastTrait.trim()}`);
  }
  return normalizeTags(nextTags);
}

function readSpellcastTrait(tags: string[]) {
  const tag = tags.find((item) => item.startsWith("spellcast:"));
  return tag ? tag.slice("spellcast:".length) : null;
}

function matchesSearch(record: HomebrewSubclassRecord, search: string) {
  if (!search) return true;
  return (
    record.name.toLowerCase().includes(search) ||
    record.description.toLowerCase().includes(search) ||
    record.classId.toLowerCase().includes(search) ||
    record.className.toLowerCase().includes(search) ||
    record.tags.some((tag) => tag.toLowerCase().includes(search))
  );
}

export async function GET(request: NextRequest) {
  try {
    const campaignId = toNumber(request.nextUrl.searchParams.get("campaignId"), 0);
    const classFilter = normalizeClassToken(request.nextUrl.searchParams.get("class") ?? "");
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

    let customRecords: HomebrewSubclassRecord[] = [];
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
      customRecords = context.homebrew.subclasses.map((item) => {
        const classId = extractSubclassClassId(item);
        return {
          ...item,
          campaignId,
          classId,
          className: classId || "custom",
          spellcastTrait: readSpellcastTrait(item.tags),
        };
      });
    }

    let records = [...toOfficialSubclassRecords(), ...customRecords];
    if (classFilter) {
      records = records.filter((record) => normalizeClassToken(record.classId) === classFilter);
    }

    records = records.filter((record) => matchesSearch(record, search));
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subclasses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsedBody = subclassInputSchema.safeParse(body);
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
    const classId = normalizeClassToken(payload.classId);
    const record = {
      id: createBuilderEntityId("subclass"),
      name: payload.name.trim(),
      description: payload.description.trim(),
      tags: mergeSubclassTags(payload.tags, classId, payload.spellcastTrait),
      isOfficial: false,
    };

    await persistCampaignHomebrew(
      payload.campaignId,
      appUser.id,
      context.notes,
      context.metadata,
      {
        ...context.homebrew,
        subclasses: [...context.homebrew.subclasses, record],
      }
    );

    return NextResponse.json(
      {
        ...record,
        campaignId: payload.campaignId,
        classId,
        className: classId,
        spellcastTrait: payload.spellcastTrait?.trim() || null,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subclass" },
      { status: 500 }
    );
  }
}
