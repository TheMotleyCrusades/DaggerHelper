import { NextRequest, NextResponse } from "next/server";
import {
  adversaryUpdateSchema,
  mapAdversaryRow,
  normalizeAdversaryPayload,
} from "@/lib/adversaries";
import { AuthError, getSessionUser, getOrCreateAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid adversary id");
  }
  return id;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseId((await params).id);
    const authUser = await getSessionUser();
    const appUser = authUser ? await getOrCreateAppUser(authUser) : null;

    let query = supabaseAdmin.from("adversaries").select("*").eq("id", id);
    if (appUser) {
      query = query.or(`user_id.eq.${appUser.id},is_public.eq.true`);
    } else {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query.single();
    if (error || !data) {
      return NextResponse.json({ error: "Adversary not found" }, { status: 404 });
    }

    return NextResponse.json(mapAdversaryRow(data));
  } catch {
    return NextResponse.json({ error: "Failed to fetch adversary" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseId((await params).id);
    const authUser = await getSessionUser();
    if (!authUser) throw new AuthError("Unauthorized", 401);
    const appUser = await getOrCreateAppUser(authUser);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("adversaries")
      .select("id,user_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Adversary not found" }, { status: 404 });
    }
    if (existing.user_id !== appUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = adversaryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = normalizeAdversaryPayload(parsed.data);
    const { data, error } = await supabaseAdmin
      .from("adversaries")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }

    return NextResponse.json(mapAdversaryRow(data));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update adversary" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseId((await params).id);
    const authUser = await getSessionUser();
    if (!authUser) throw new AuthError("Unauthorized", 401);
    const appUser = await getOrCreateAppUser(authUser);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("adversaries")
      .select("id,user_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Adversary not found" }, { status: 404 });
    }
    if (existing.user_id !== appUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("adversaries").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to delete adversary" }, { status: 500 });
  }
}
