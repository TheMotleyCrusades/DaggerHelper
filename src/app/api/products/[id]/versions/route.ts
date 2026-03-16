import { NextRequest, NextResponse } from "next/server";
import {
  AuthError,
  getOrCreateAppUser,
  getSessionUser,
  requireAppUser,
} from "@/lib/auth";
import { productVersionCreateSchema } from "@/lib/content/schemas";
import {
  createProductVersion,
  listProductVersions,
} from "@/lib/content/queries";

type RouteParams = { id: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const authUser = await getSessionUser();
    const appUser = authUser ? await getOrCreateAppUser(authUser) : null;
    const productId = (await params).id;
    const versions = await listProductVersions(appUser?.id ?? 0, productId);
    return NextResponse.json(versions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const productId = (await params).id;
    const body = await request.json();
    const parsed = productVersionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await createProductVersion(appUser.id, productId, {
      versionLabel: parsed.data.versionLabel,
      releaseNotes: parsed.data.releaseNotes,
      isPublished: parsed.data.isPublished,
      snapshotPayload: parsed.data.snapshotPayload,
      stripePriceId: parsed.data.stripePriceId,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create version" },
      { status: 500 }
    );
  }
}
