import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { claimFreeProduct } from "@/lib/content/catalog";
import { getProductById } from "@/lib/content/queries";

type RouteParams = { id: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { appUser } = await requireAppUser();
    const productId = (await params).id;
    const product = await getProductById(appUser.id, productId, true);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const entitlement = await claimFreeProduct(appUser.id, product);
    return NextResponse.json({ success: true, entitlement });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to claim product" },
      { status: 500 }
    );
  }
}
