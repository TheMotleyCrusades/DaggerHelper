import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { deleteProductDocument, updateProductDocument } from "@/lib/content/documents";
import { getProductById } from "@/lib/content/queries";
import { documentCreateSchema } from "@/lib/content/schemas";

type RouteParams = { id: string; versionId: string; documentId: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const { id, documentId } = await params;
    const product = await getProductById(appUser.id, id, false);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = documentCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await updateProductDocument({
      id: documentId,
      patch: {
        parentDocumentId: parsed.data.parentDocumentId,
        slug: parsed.data.slug,
        title: parsed.data.title,
        bodyMarkdown: parsed.data.bodyMarkdown,
        teaserMarkdown: parsed.data.teaserMarkdown,
        visibility: parsed.data.visibility,
        sortOrder: parsed.data.sortOrder,
      },
    });
    if (!updated) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const { id, documentId } = await params;
    const product = await getProductById(appUser.id, id, false);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await deleteProductDocument(documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 }
    );
  }
}
