import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid adversary id");
  }
  return id;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseId((await params).id);
    const { appUser } = await requireAppUser();

    const { data: adversaryRaw, error: adversaryError } = await supabaseAdmin
      .from("adversaries")
      .select("id,is_public")
      .eq("id", id)
      .single();
    const adversary = adversaryRaw as { id: number; is_public: boolean } | null;

    if (adversaryError || !adversary) {
      return NextResponse.json({ error: "Adversary not found" }, { status: 404 });
    }
    if (!adversary.is_public) {
      return NextResponse.json(
        { error: "Only public adversaries can be favourited" },
        { status: 403 }
      );
    }

    const { data: existingRaw, error: existingError } = await supabaseAdmin
      .from("adversary_favourites")
      .select("id")
      .eq("user_id", appUser.id)
      .eq("adversary_id", id)
      .maybeSingle();
    const existing = existingRaw as { id: number } | null;

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    let favourited = false;
    if (existing) {
      const { error } = await supabaseAdmin
        .from("adversary_favourites")
        .delete()
        .eq("id", existing.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      favourited = false;
    } else {
      const { error } = await supabaseAdmin.from("adversary_favourites").insert({
        user_id: appUser.id,
        adversary_id: id,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      favourited = true;
    }

    const { count } = await supabaseAdmin
      .from("adversary_favourites")
      .select("*", { count: "exact", head: true })
      .eq("adversary_id", id);

    return NextResponse.json({
      success: true,
      favourited,
      count: count ?? 0,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to toggle favourite" }, { status: 500 });
  }
}
