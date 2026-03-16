import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { homebrewEntityCreateSchema } from "@/lib/content/schemas";
import { createHomebrewEntity, listUserHomebrewEntities } from "@/lib/content/queries";
import { getOwnedCampaign } from "@/lib/homebrew-api";

function toNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const entityKind = request.nextUrl.searchParams.get("kind")?.trim().toLowerCase() ?? "";
    const scope = request.nextUrl.searchParams.get("scope")?.trim().toLowerCase() ?? "";
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const campaignId = toNumber(request.nextUrl.searchParams.get("campaignId"));

    const content = await listUserHomebrewEntities(appUser.id, {
      entityKind: entityKind || undefined,
      scope: scope === "campaign" || scope === "personal" ? scope : undefined,
      search: search || undefined,
      campaignId: campaignId && campaignId > 0 ? campaignId : undefined,
    });

    return NextResponse.json(content);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch content" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = homebrewEntityCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    if (payload.scope === "campaign") {
      if (!payload.campaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      const ownedCampaign = await getOwnedCampaign(payload.campaignId, appUser.id);
      if (!ownedCampaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }

    const created = await createHomebrewEntity(appUser.id, {
      entityKind: payload.entityKind,
      scope: payload.scope,
      campaignId: payload.campaignId,
      lineageKey: payload.lineageKey,
      slug: payload.slug,
      name: payload.name,
      description: payload.description,
      payload: payload.payload,
      tags: payload.tags,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create content" },
      { status: 500 }
    );
  }
}
