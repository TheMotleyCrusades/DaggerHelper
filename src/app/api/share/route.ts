import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { createShareId } from "@/lib/share-token";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createShareSchema = z.object({
  characterId: z.number().int().positive(),
  expiresInDays: z.number().int().positive().max(365).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();

    const body = await request.json();
    const parsed = createShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const { data: character, error } = await supabaseAdmin
      .from("characters")
      .select("id")
      .eq("id", payload.characterId)
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const shareId = createShareId(payload.characterId, payload.expiresInDays ?? null);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json({
      shareId,
      shareUrl: `${baseUrl.replace(/\/$/, "")}/share/${shareId}`,
      expiresInDays: payload.expiresInDays ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create share link" },
      { status: 500 }
    );
  }
}
