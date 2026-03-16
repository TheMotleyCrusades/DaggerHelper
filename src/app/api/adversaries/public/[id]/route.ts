import { NextRequest, NextResponse } from "next/server";
import { mapAdversaryRow } from "@/lib/adversaries";
import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid adversary id");
  }
  return id;
}

function toDisplayName(user: { email: string | null; username: string | null; name: string | null } | null) {
  if (!user) return "Unknown";
  return user.name?.trim() || user.username?.trim() || user.email?.split("@")[0] || "Unknown";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseId((await params).id);
    const { data: adversaryRaw, error: adversaryError } = await supabaseAdmin
      .from("adversaries")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .single();

    if (adversaryError || !adversaryRaw) {
      return NextResponse.json({ error: "Adversary not found" }, { status: 404 });
    }

    const mapped = mapAdversaryRow(adversaryRaw as Record<string, unknown>);
    const creatorId = Number(mapped.userId);
    const authUser = await getSessionUser();

    const [favouritesResult, creatorResult, appUserResult] = await Promise.all([
      supabaseAdmin
        .from("adversary_favourites")
        .select("user_id")
        .eq("adversary_id", id),
      Number.isInteger(creatorId)
        ? supabaseAdmin
            .from("users")
            .select("email,username,name")
            .eq("id", creatorId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      authUser?.email
        ? supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", authUser.email.toLowerCase().trim())
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const favourites = (favouritesResult.data ?? []) as Array<{ user_id: number }>;
    const appUserId = Number(appUserResult.data?.id ?? 0) || null;
    const favouriteCount = favourites.length;
    const favourited = appUserId
      ? favourites.some((favourite) => favourite.user_id === appUserId)
      : false;

    return NextResponse.json({
      ...mapped,
      favouriteCount,
      favourited,
      creator: {
        id: Number.isInteger(creatorId) ? creatorId : null,
        name: toDisplayName(
          (creatorResult.data as { email: string | null; username: string | null; name: string | null } | null) ??
            null
        ),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch public adversary" }, { status: 500 });
  }
}
