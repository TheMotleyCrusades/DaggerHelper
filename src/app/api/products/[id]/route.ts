import { NextRequest, NextResponse } from "next/server";
import {
  AuthError,
  getOrCreateAppUser,
  getSessionUser,
  requireAppUser,
} from "@/lib/auth";
import { productUpdateSchema } from "@/lib/content/schemas";
import {
  getProductById,
  updateProductForOwner,
} from "@/lib/content/queries";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteParams = { id: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const authUser = await getSessionUser();
    const appUser = authUser ? await getOrCreateAppUser(authUser) : null;
    const id = (await params).id;
    const product = await getProductById(appUser?.id ?? 0, id, true);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch product" },
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
    const id = (await params).id;
    const body = await request.json();
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const patch = parsed.data;
    if (patch.access === "paid" && patch.visibility === "listed") {
      return NextResponse.json(
        { error: "Paid listings are disabled until commerce phase is enabled." },
        { status: 400 }
      );
    }

    const updated = await updateProductForOwner(appUser.id, id, {
      title: patch.title,
      slug: patch.slug,
      summary: patch.summary,
      access: patch.access,
      visibility: patch.visibility,
      teaser: patch.teaser,
      isHidden: patch.isHidden,
      coverImageUrl: patch.coverImageUrl,
      stripeProductId: patch.stripeProductId,
      stripeAccountId: patch.stripeAccountId,
    });
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update product" },
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
    const id = (await params).id;
    const { error } = await supabaseAdmin
      .from("content_products")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", appUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete product" },
      { status: 500 }
    );
  }
}
