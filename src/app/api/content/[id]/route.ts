import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { homebrewEntityUpdateSchema } from "@/lib/content/schemas";
import {
  archiveHomebrewEntity,
  getHomebrewEntityById,
  updateHomebrewEntity,
} from "@/lib/content/queries";
import { getOwnedCampaign } from "@/lib/homebrew-api";

type RouteParams = { id: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = (await params).id;
    const content = await getHomebrewEntityById(appUser.id, id);
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = (await params).id;

    const body = await request.json();
    const parsed = homebrewEntityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    if (patch.scope === "campaign") {
      if (!patch.campaignId) {
        return NextResponse.json({ error: "campaignId is required for campaign scope" }, { status: 400 });
      }
      const ownedCampaign = await getOwnedCampaign(patch.campaignId, appUser.id);
      if (!ownedCampaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
    }

    const updated = await updateHomebrewEntity(appUser.id, id, {
      entityKind: patch.entityKind,
      scope: patch.scope,
      campaignId: patch.campaignId,
      lineageKey: patch.lineageKey,
      slug: patch.slug,
      name: patch.name,
      description: patch.description,
      payload: patch.payload,
      tags: patch.tags,
      isArchived: patch.isArchived,
    });
    if (!updated) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update content" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = (await params).id;
    const archived = await archiveHomebrewEntity(appUser.id, id);
    if (!archived) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, content: archived });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive content" },
      { status: 500 }
    );
  }
}
