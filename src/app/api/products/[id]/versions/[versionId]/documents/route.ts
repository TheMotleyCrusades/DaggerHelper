import { NextRequest, NextResponse } from "next/server";
import {
  AuthError,
  getOrCreateAppUser,
  getSessionUser,
  requireAppUser,
} from "@/lib/auth";
import { createProductDocument, listProductDocuments } from "@/lib/content/documents";
import { getProductById } from "@/lib/content/queries";
import { documentCreateSchema } from "@/lib/content/schemas";

type RouteParams = { id: string; versionId: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id, versionId } = await params;
    const authUser = await getSessionUser();
    const appUser = authUser ? await getOrCreateAppUser(authUser) : null;
    const documents = await listProductDocuments({
      productId: id,
      productVersionId: versionId,
      viewerUserId: appUser?.id ?? null,
      includeTeaserOnlyWhenNoEntitlement: true,
    });
    return NextResponse.json(documents);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch documents" },
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
    const { id, versionId } = await params;
    const product = await getProductById(appUser.id, id, false);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = documentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await createProductDocument({
      productVersionId: versionId,
      parentDocumentId: parsed.data.parentDocumentId ?? null,
      slug: parsed.data.slug,
      title: parsed.data.title,
      bodyMarkdown: parsed.data.bodyMarkdown,
      teaserMarkdown: parsed.data.teaserMarkdown,
      visibility: parsed.data.visibility,
      sortOrder: parsed.data.sortOrder,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create document" },
      { status: 500 }
    );
  }
}
