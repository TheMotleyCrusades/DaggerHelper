import { NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { resourceDefinitionSchema } from "@/lib/characters";
import {
  findOwnedCollectionEntry,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

const resourceTemplateUpdateSchema = resourceDefinitionSchema.partial();

function parseId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid resource template id");
  }
  return id;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const templateId = parseId((await params).id);
    const body = await request.json();
    const parsedBody = resourceTemplateUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const found = await findOwnedCollectionEntry(appUser.id, "resourceTemplates", templateId);
    if (!found) {
      return NextResponse.json({ error: "Resource template not found" }, { status: 404 });
    }

    const patch = parsedBody.data;
    const current = found.item;
    const updated = {
      ...current,
      id: current.id,
      label: patch.label?.trim() || current.label,
      defaultCurrent: patch.defaultCurrent ?? current.defaultCurrent,
      defaultMax: patch.defaultMax ?? current.defaultMax,
      min: patch.min ?? current.min,
      max: patch.max ?? current.max,
      format: patch.format ?? current.format,
      playerEditable: patch.playerEditable ?? current.playerEditable,
      allowPermanentShift: patch.allowPermanentShift ?? current.allowPermanentShift,
      allowTemporaryModifiers:
        patch.allowTemporaryModifiers ?? current.allowTemporaryModifiers,
      visibleOn: patch.visibleOn ?? current.visibleOn,
    };

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        resourceTemplates: found.homebrew.resourceTemplates.map((item) =>
          item.id === templateId ? updated : item
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
      { error: error instanceof Error ? error.message : "Failed to update resource template" },
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
    const templateId = parseId((await params).id);

    const found = await findOwnedCollectionEntry(appUser.id, "resourceTemplates", templateId);
    if (!found) {
      return NextResponse.json({ error: "Resource template not found" }, { status: 404 });
    }

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        resourceTemplates: found.homebrew.resourceTemplates.filter(
          (item) => item.id !== templateId
        ),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete resource template" },
      { status: 500 }
    );
  }
}
