import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const profileUpdateSchema = z.object({
  username: z.string().min(2).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
});

export async function GET() {
  try {
    const { authUser, appUser } = await requireAppUser();
    return NextResponse.json({
      id: appUser.id,
      email: authUser.email,
      username: appUser.username,
      name: appUser.name,
      role: appUser.role,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        username: parsed.data.username?.trim() || null,
        name: parsed.data.name?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appUser.id)
      .select("id,email,username,name,role")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { authUser, appUser } = await requireAppUser();

    await supabaseAdmin.from("users").delete().eq("id", appUser.id);

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }

    const supabase = await createServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
