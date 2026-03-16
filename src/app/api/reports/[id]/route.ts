import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { moderateContentReport } from "@/lib/content/moderation";

const moderationSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  action: z.enum(["dismiss", "warn", "delist", "restrict"]),
  note: z.string().max(4000).optional(),
});

function isModerator(role: string | null) {
  return role === "moderator" || role === "admin";
}

type RouteParams = { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    if (!isModerator(appUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = moderationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const reportId = (await params).id;
    const result = await moderateContentReport({
      reportId,
      actedByUserId: appUser.id,
      status: parsed.data.status,
      action: parsed.data.action,
      note: parsed.data.note,
    });
    if (!result) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to moderate report" },
      { status: 500 }
    );
  }
}
