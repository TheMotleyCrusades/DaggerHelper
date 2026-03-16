import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  createContentReport,
  listContentReports,
} from "@/lib/content/moderation";

const reportCreateSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  entityKind: z.string().max(120).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  reason: z.string().min(3).max(240),
  details: z.string().max(4000).optional(),
});

function isModerator(role: string | null) {
  return role === "moderator" || role === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    if (!isModerator(appUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get("status");
    const reports = await listContentReports({
      status: status === "open" || status === "resolved" || status === "dismissed" ? status : undefined,
    });
    return NextResponse.json(reports);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = reportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await createContentReport({
      reporterUserId: appUser.id,
      productId: parsed.data.productId,
      entityKind: parsed.data.entityKind,
      entityId: parsed.data.entityId,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create report" },
      { status: 500 }
    );
  }
}
