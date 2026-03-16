import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { homebrewEntityInputSchema } from "@/lib/characters";
import {
  findOwnedCollectionEntry,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

function parseId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid ancestry id");
  }
  return id;
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const ancestryId = parseId((await params).id);
    const body = await request.json();
    const parsedBody = homebrewEntityInputSchema.partial().safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const found = await findOwnedCollectionEntry(appUser.id, "ancestries", ancestryId);
    if (!found) {
      return NextResponse.json({ error: "Ancestry not found" }, { status: 404 });
    }

    const patch = parsedBody.data;
    const current = found.item;
    const nextTags =
      patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags;

    const updated = {
      ...current,
      name: patch.name?.trim() || current.name,
      description:
        patch.description !== undefined ? patch.description.trim() : current.description,
      tags: nextTags,
      isOfficial: false,
    };

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        ancestries: found.homebrew.ancestries.map((item) =>
          item.id === ancestryId ? updated : item
        ),
      }
    );

    return NextResponse.json({
      ...updated,
      campaignId: found.campaignId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update ancestry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const ancestryId = parseId((await params).id);

    const found = await findOwnedCollectionEntry(appUser.id, "ancestries", ancestryId);
    if (!found) {
      return NextResponse.json({ error: "Ancestry not found" }, { status: 404 });
    }

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        ancestries: found.homebrew.ancestries.filter((item) => item.id !== ancestryId),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete ancestry" },
      { status: 500 }
    );
  }
}
