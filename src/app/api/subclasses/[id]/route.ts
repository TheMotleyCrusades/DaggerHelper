import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import {
  findOwnedCollectionEntry,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";
import { extractSubclassClassId, normalizeClassToken } from "@/lib/homebrew-library";

const subclassUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  classId: z.string().min(1).max(120).optional(),
  spellcastTrait: z.string().max(80).optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid subclass id");
  }
  return id;
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

function mergeSubclassTags(baseTags: string[], classId: string, spellcastTrait?: string) {
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
  return tag ? tag.slice("spellcast:".length) : "";
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const subclassId = parseId((await params).id);
    const body = await request.json();
    const parsedBody = subclassUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const found = await findOwnedCollectionEntry(appUser.id, "subclasses", subclassId);
    if (!found) {
      return NextResponse.json({ error: "Subclass not found" }, { status: 404 });
    }

    const patch = parsedBody.data;
    const current = found.item;
    const nextClassId = patch.classId
      ? normalizeClassToken(patch.classId)
      : extractSubclassClassId(current);
    const nextSpellcastTrait =
      patch.spellcastTrait !== undefined
        ? patch.spellcastTrait.trim()
        : readSpellcastTrait(current.tags);

    const updated = {
      ...current,
      name: patch.name?.trim() || current.name,
      description:
        patch.description !== undefined ? patch.description.trim() : current.description,
      tags: mergeSubclassTags(patch.tags ?? current.tags, nextClassId, nextSpellcastTrait),
      isOfficial: false,
    };

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        subclasses: found.homebrew.subclasses.map((item) =>
          item.id === subclassId ? updated : item
        ),
      }
    );

    return NextResponse.json({
      ...updated,
      campaignId: found.campaignId,
      classId: nextClassId,
      className: nextClassId,
      spellcastTrait: nextSpellcastTrait || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update subclass" },
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
    const subclassId = parseId((await params).id);

    const found = await findOwnedCollectionEntry(appUser.id, "subclasses", subclassId);
    if (!found) {
      return NextResponse.json({ error: "Subclass not found" }, { status: 404 });
    }

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        subclasses: found.homebrew.subclasses.filter((item) => item.id !== subclassId),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete subclass" },
      { status: 500 }
    );
  }
}
