import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import {
  findOwnedCollectionEntry,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

const conditionUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(600).optional(),
  playerToggle: z.boolean().optional(),
  visibleToPlayers: z.boolean().optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid condition id");
  }
  return id;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const conditionId = parseId((await params).id);
    const body = await request.json();
    const parsedBody = conditionUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const found = await findOwnedCollectionEntry(appUser.id, "conditions", conditionId);
    if (!found) {
      return NextResponse.json({ error: "Condition not found" }, { status: 404 });
    }

    const patch = parsedBody.data;
    const current = found.item;
    const updated = {
      ...current,
      name: patch.name?.trim() || current.name,
      description:
        patch.description !== undefined ? patch.description.trim() : current.description,
      playerToggle: patch.playerToggle ?? current.playerToggle,
      visibleToPlayers: patch.visibleToPlayers ?? current.visibleToPlayers,
    };

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        conditions: found.homebrew.conditions.map((item) =>
          item.id === conditionId ? updated : item
        ),
      }
    );

    return NextResponse.json({
      ...updated,
      campaignId: found.campaignId,
      isOfficial: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update condition" },
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
    const conditionId = parseId((await params).id);

    const found = await findOwnedCollectionEntry(appUser.id, "conditions", conditionId);
    if (!found) {
      return NextResponse.json({ error: "Condition not found" }, { status: 404 });
    }

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        conditions: found.homebrew.conditions.filter((item) => item.id !== conditionId),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete condition" },
      { status: 500 }
    );
  }
}
