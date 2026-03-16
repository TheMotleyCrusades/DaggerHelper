import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/auth";
import { TRAIT_KEYS } from "@/lib/constants/classes";
import {
  findOwnedCollectionEntry,
  persistCampaignHomebrew,
} from "@/lib/homebrew-api";

const skillUpdateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  helperText: z.string().max(300).optional(),
  traits: z.array(z.enum(TRAIT_KEYS)).min(1).optional(),
});

function parseId(value: string) {
  const id = value.trim();
  if (!id) {
    throw new Error("Invalid skill id");
  }
  return id;
}

function normalizeTraits(traits: string[]) {
  return Array.from(new Set(traits.map((trait) => trait.trim().toLowerCase()).filter(Boolean)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const skillId = parseId((await params).id);
    const body = await request.json();
    const parsedBody = skillUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
    }

    const found = await findOwnedCollectionEntry(appUser.id, "skills", skillId);
    if (!found) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const patch = parsedBody.data;
    const current = found.item;
    const updated = {
      ...current,
      label: patch.label?.trim() || current.label,
      helperText:
        patch.helperText !== undefined ? patch.helperText.trim() : current.helperText,
      traits: patch.traits ? normalizeTraits(patch.traits) : current.traits,
    };

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        skills: found.homebrew.skills.map((item) => (item.id === skillId ? updated : item)),
      }
    );

    return NextResponse.json({
      ...updated,
      campaignId: found.campaignId,
      isOfficial: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update skill" },
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
    const skillId = parseId((await params).id);

    const found = await findOwnedCollectionEntry(appUser.id, "skills", skillId);
    if (!found) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    await persistCampaignHomebrew(
      found.campaignId,
      appUser.id,
      found.notes,
      found.metadata,
      {
        ...found.homebrew,
        skills: found.homebrew.skills.filter((item) => item.id !== skillId),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete skill" },
      { status: 500 }
    );
  }
}
