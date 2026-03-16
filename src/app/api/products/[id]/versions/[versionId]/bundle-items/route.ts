import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { bundleItemSchema } from "@/lib/content/schemas";
import {
  listBundleItemsForVersion,
  replaceBundleItemsForVersion,
} from "@/lib/content/queries";

const bundleItemArraySchema = z.array(bundleItemSchema);

type RouteParams = { id: string; versionId: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const { id, versionId } = await params;
    const items = await listBundleItemsForVersion(appUser.id, id, versionId);
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch bundle items" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const { id, versionId } = await params;
    const body = await request.json();
    const parsed = bundleItemArraySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const items = await replaceBundleItemsForVersion(appUser.id, id, versionId, parsed.data);
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update bundle items" },
      { status: 500 }
    );
  }
}
