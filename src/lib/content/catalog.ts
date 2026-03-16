import { mapEntitlementRow } from "@/lib/content/mappers";
import { listCatalogProducts } from "@/lib/content/queries";
import type { CatalogVisibility, ContentProductRecord, ProductAccess } from "@/lib/content/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CatalogListInput = {
  viewerUserId?: number | null;
  visibility?: CatalogVisibility;
  access?: ProductAccess;
  search?: string;
  includeHidden?: boolean;
};

export async function listCatalogEntries(input: CatalogListInput = {}) {
  const visibility = input.visibility ?? "listed";
  const products = await listCatalogProducts({
    visibility,
    access: input.access,
    search: input.search,
    includeHidden: input.includeHidden ?? false,
  });

  if (!input.viewerUserId) {
    return products.map((product) => ({
      ...product,
      entitled: false,
    }));
  }

  const productIds = products.map((product) => product.id);
  if (!productIds.length) return [];

  const { data, error } = await supabaseAdmin
    .from("user_content_entitlements")
    .select("*")
    .eq("user_id", input.viewerUserId)
    .eq("status", "active")
    .in("product_id", productIds);

  if (error) throw new Error(error.message);
  const entitlementSet = new Set(
    ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapEntitlementRow(row).productId)
  );

  return products.map((product) => ({
    ...product,
    entitled: entitlementSet.has(product.id),
  }));
}

export async function claimFreeProduct(userId: number, product: ContentProductRecord) {
  if (product.access !== "free") {
    throw new Error("Only free products can be claimed.");
  }
  if (product.visibility === "draft") {
    throw new Error("Draft products cannot be claimed.");
  }

  const payload = {
    user_id: userId,
    product_id: product.id,
    product_version_id: null,
    source: "claim",
    status: "active",
    granted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("user_content_entitlements")
    .upsert(payload, { onConflict: "user_id,product_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to claim product");
  }

  return mapEntitlementRow(data);
}
