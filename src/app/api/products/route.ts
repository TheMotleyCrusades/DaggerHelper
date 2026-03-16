import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateAppUser,
  getSessionUser,
  AuthError,
  requireAppUser,
} from "@/lib/auth";
import { listCatalogEntries } from "@/lib/content/catalog";
import { productCreateSchema } from "@/lib/content/schemas";
import { createProductDraft, listProductsForOwner } from "@/lib/content/queries";

export async function GET(request: NextRequest) {
  try {
    const catalogMode = request.nextUrl.searchParams.get("catalog") === "true";
    if (catalogMode) {
      const authUser = await getSessionUser();
      const appUser = authUser ? await getOrCreateAppUser(authUser) : null;
      const search = request.nextUrl.searchParams.get("search")?.trim();
      const access = request.nextUrl.searchParams.get("access");
      const entries = await listCatalogEntries({
        viewerUserId: appUser?.id ?? null,
        visibility: "listed",
        access: access === "free" || access === "paid" ? access : undefined,
        search: search || undefined,
      });
      return NextResponse.json(entries);
    }

    const { appUser } = await requireAppUser();
    const products = await listProductsForOwner(appUser.id);
    return NextResponse.json(products);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.access === "paid" && parsed.data.visibility === "listed") {
      return NextResponse.json(
        { error: "Paid listings are disabled until commerce phase is enabled." },
        { status: 400 }
      );
    }

    const product = await createProductDraft(appUser.id, {
      title: parsed.data.title,
      slug: parsed.data.slug,
      summary: parsed.data.summary,
      access: parsed.data.access,
      visibility: parsed.data.visibility,
      teaser: parsed.data.teaser,
      isHidden: parsed.data.isHidden,
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
