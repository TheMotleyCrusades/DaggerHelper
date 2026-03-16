import { NextRequest, NextResponse } from "next/server";
import {
  adversaryInputSchema,
  mapAdversaryRow,
  normalizeAdversaryPayload,
} from "@/lib/adversaries";
import { AuthError, requireAppUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { appUser } = await requireAppUser();
    const { data, error } = await supabaseAdmin
      .from("adversaries")
      .select("*")
      .eq("user_id", appUser.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return NextResponse.json(rows.map((row) => mapAdversaryRow(row)));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch adversaries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = adversaryInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = normalizeAdversaryPayload(parsed.data);
    const { data, error } = await supabaseAdmin
      .from("adversaries")
      .insert({
        ...payload,
        user_id: appUser.id,
        is_homebrew: true,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapAdversaryRow(data), { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create adversary" }, { status: 500 });
  }
}
