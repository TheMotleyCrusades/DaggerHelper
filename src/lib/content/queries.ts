import {
  mapBundleItemRow,
  mapContentProductRow,
  mapContentVersionRow,
  mapDocumentRow,
  mapHomebrewEntityRow,
} from "@/lib/content/mappers";
import type {
  CatalogListFilters,
  ContentBundleItemRecord,
  ContentDocumentRecord,
  ContentProductRecord,
  ContentProductVersionRecord,
  HomebrewEntityCreateInput,
  HomebrewEntityRecord,
  HomebrewEntityUpdateInput,
  ProductCreateInput,
  ProductUpdateInput,
  ProductVersionCreateInput,
} from "@/lib/content/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTags(tags?: string[]) {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeLineage(entityKind: string, name: string, lineageKey?: string) {
  if (lineageKey?.trim()) return lineageKey.trim().toLowerCase();
  const kind = toSlug(entityKind) || "content";
  const base = toSlug(name) || "entry";
  return `${kind}-${base}`;
}

export async function listUserHomebrewEntities(
  userId: number,
  filters?: { entityKind?: string; scope?: "personal" | "campaign"; search?: string; campaignId?: number }
) {
  let query = supabaseAdmin
    .from("homebrew_entities")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (filters?.entityKind) {
    query = query.eq("entity_kind", filters.entityKind);
  }
  if (filters?.scope) {
    query = query.eq("scope", filters.scope);
  }
  if (filters?.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const search = filters?.search?.trim().toLowerCase();
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped = rows.map((row) => mapHomebrewEntityRow(row));
  if (!search) return mapped;

  return mapped.filter((entry) => {
    return (
      entry.name.toLowerCase().includes(search) ||
      entry.description.toLowerCase().includes(search) ||
      entry.entityKind.toLowerCase().includes(search) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  });
}

export async function createHomebrewEntity(
  userId: number,
  input: HomebrewEntityCreateInput
): Promise<HomebrewEntityRecord> {
  const scope = input.scope ?? "personal";
  const slug = input.slug?.trim() || toSlug(input.name) || "content-entry";
  const lineageKey = normalizeLineage(input.entityKind, input.name, input.lineageKey);

  const { data, error } = await supabaseAdmin
    .from("homebrew_entities")
    .insert({
      lineage_key: lineageKey,
      entity_kind: input.entityKind.trim().toLowerCase(),
      scope,
      owner_user_id: userId,
      campaign_id: scope === "campaign" ? input.campaignId ?? null : null,
      slug,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      payload: input.payload ?? {},
      tags: normalizeTags(input.tags),
      is_archived: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create content entity");
  }
  return mapHomebrewEntityRow(data);
}

export async function getHomebrewEntityById(userId: number, id: string) {
  const { data, error } = await supabaseAdmin
    .from("homebrew_entities")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapHomebrewEntityRow(data);
}

export async function updateHomebrewEntity(
  userId: number,
  id: string,
  patch: HomebrewEntityUpdateInput
) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.entityKind !== undefined) updates.entity_kind = patch.entityKind.trim().toLowerCase();
  if (patch.scope !== undefined) updates.scope = patch.scope;
  if (patch.campaignId !== undefined) updates.campaign_id = patch.campaignId;
  if (patch.lineageKey !== undefined) updates.lineage_key = patch.lineageKey.trim().toLowerCase();
  if (patch.slug !== undefined) updates.slug = patch.slug.trim();
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.description !== undefined) updates.description = patch.description.trim();
  if (patch.payload !== undefined) updates.payload = patch.payload;
  if (patch.tags !== undefined) updates.tags = normalizeTags(patch.tags);
  if (patch.isArchived !== undefined) updates.is_archived = patch.isArchived;

  const { data, error } = await supabaseAdmin
    .from("homebrew_entities")
    .update(updates)
    .eq("id", id)
    .eq("owner_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapHomebrewEntityRow(data);
}

export async function archiveHomebrewEntity(userId: number, id: string) {
  const { data, error } = await supabaseAdmin
    .from("homebrew_entities")
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapHomebrewEntityRow(data);
}

export async function listProductsForOwner(userId: number): Promise<ContentProductRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("content_products")
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapContentProductRow(row));
}

export async function createProductDraft(
  userId: number,
  input: ProductCreateInput
): Promise<ContentProductRecord> {
  const slug = input.slug?.trim() || toSlug(input.title) || "content-product";
  const { data, error } = await supabaseAdmin
    .from("content_products")
    .insert({
      owner_user_id: userId,
      publisher: "creator",
      access: input.access ?? "free",
      visibility: input.visibility ?? "draft",
      title: input.title.trim(),
      slug,
      summary: input.summary?.trim() ?? "",
      teaser: input.teaser?.trim() ?? "",
      is_hidden: input.isHidden ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create product");
  return mapContentProductRow(data);
}

export async function getProductById(
  userId: number,
  id: string,
  includeListedWhenNotOwner = true
): Promise<ContentProductRecord | null> {
  let query = supabaseAdmin.from("content_products").select("*").eq("id", id);
  if (!includeListedWhenNotOwner) {
    query = query.eq("owner_user_id", userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const mapped = mapContentProductRow(data);
  if (mapped.ownerUserId === userId) return mapped;

  if (!includeListedWhenNotOwner) return null;
  if (mapped.visibility === "listed") return mapped;
  if (mapped.visibility === "draft") return null;

  // Delisted entries remain visible to entitled users.
  if (mapped.visibility === "delisted") {
    if (!Number.isFinite(userId) || userId <= 0) return null;

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from("user_content_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", id)
      .eq("status", "active")
      .maybeSingle();
    if (entitlementError) throw new Error(entitlementError.message);

    return entitlement ? mapped : null;
  }

  return null;
}

export async function updateProductForOwner(
  userId: number,
  id: string,
  patch: ProductUpdateInput
) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.title !== undefined) updates.title = patch.title.trim();
  if (patch.slug !== undefined) updates.slug = patch.slug.trim();
  if (patch.summary !== undefined) updates.summary = patch.summary.trim();
  if (patch.access !== undefined) updates.access = patch.access;
  if (patch.visibility !== undefined) updates.visibility = patch.visibility;
  if (patch.teaser !== undefined) updates.teaser = patch.teaser.trim();
  if (patch.isHidden !== undefined) updates.is_hidden = patch.isHidden;
  if (patch.coverImageUrl !== undefined) updates.cover_image_url = patch.coverImageUrl;
  if (patch.stripeProductId !== undefined) updates.stripe_product_id = patch.stripeProductId;
  if (patch.stripeAccountId !== undefined) updates.stripe_account_id = patch.stripeAccountId;

  const { data, error } = await supabaseAdmin
    .from("content_products")
    .update(updates)
    .eq("id", id)
    .eq("owner_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapContentProductRow(data);
}

export async function listProductVersions(
  userId: number,
  productId: string
): Promise<ContentProductVersionRecord[]> {
  const product = await getProductById(userId, productId, true);
  if (!product) return [];
  if (product.ownerUserId !== userId && product.visibility === "draft") {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("content_product_versions")
    .select("*")
    .eq("product_id", productId)
    .order("version_number", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapContentVersionRow(row));
}

export async function createProductVersion(
  userId: number,
  productId: string,
  input: ProductVersionCreateInput
): Promise<ContentProductVersionRecord> {
  const product = await getProductById(userId, productId, false);
  if (!product) throw new Error("Product not found");

  const { count, error: countError } = await supabaseAdmin
    .from("content_product_versions")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (countError) throw new Error(countError.message);

  const versionNumber = Math.max(1, Number(count ?? 0) + 1);
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("content_product_versions")
    .insert({
      product_id: productId,
      version_number: versionNumber,
      version_label: input.versionLabel?.trim() ?? `v${versionNumber}`,
      release_notes: input.releaseNotes?.trim() ?? "",
      is_published: Boolean(input.isPublished),
      published_at: input.isPublished ? now : null,
      snapshot_payload: input.snapshotPayload ?? {},
      stripe_price_id: input.stripePriceId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create product version");
  return mapContentVersionRow(data);
}

export async function listBundleItemsForVersion(
  userId: number,
  productId: string,
  versionId: string
): Promise<ContentBundleItemRecord[]> {
  const product = await getProductById(userId, productId, true);
  if (!product) return [];

  const { data, error } = await supabaseAdmin
    .from("content_bundle_items")
    .select("*")
    .eq("product_version_id", versionId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapBundleItemRow(row));
}

export async function replaceBundleItemsForVersion(
  userId: number,
  productId: string,
  versionId: string,
  items: Array<{
    entityKind: string;
    sourceEntityId?: string | null;
    sourceTable?: string | null;
    lineageKey?: string | null;
    payload?: Record<string, unknown>;
    sortOrder?: number;
  }>
) {
  const product = await getProductById(userId, productId, false);
  if (!product) throw new Error("Product not found");

  const { error: deleteError } = await supabaseAdmin
    .from("content_bundle_items")
    .delete()
    .eq("product_version_id", versionId);
  if (deleteError) throw new Error(deleteError.message);

  if (!items.length) return [];

  const records = items.map((item, index) => ({
    product_version_id: versionId,
    entity_kind: item.entityKind.trim().toLowerCase(),
    source_entity_id: item.sourceEntityId ?? null,
    source_table: item.sourceTable ?? null,
    lineage_key: item.lineageKey ?? null,
    payload: item.payload ?? {},
    sort_order: item.sortOrder ?? index,
    created_at: new Date().toISOString(),
  }));
  const { data, error } = await supabaseAdmin
    .from("content_bundle_items")
    .insert(records)
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapBundleItemRow(row));
}

export async function listDocumentsForVersion(
  userId: number,
  productId: string,
  versionId: string
): Promise<ContentDocumentRecord[]> {
  const product = await getProductById(userId, productId, true);
  if (!product) return [];

  const { data, error } = await supabaseAdmin
    .from("content_documents")
    .select("*")
    .eq("product_version_id", versionId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapDocumentRow(row));
}

export async function listCatalogProducts(filters: CatalogListFilters = {}) {
  let query = supabaseAdmin.from("content_products").select("*").order("updated_at", { ascending: false });

  if (filters.visibility) query = query.eq("visibility", filters.visibility);
  if (filters.access) query = query.eq("access", filters.access);
  if (filters.ownerUserId) query = query.eq("owner_user_id", filters.ownerUserId);
  if (!filters.includeHidden) query = query.eq("is_hidden", false);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapContentProductRow(row));

  const search = filters.search?.trim().toLowerCase();
  if (!search) return mapped;
  return mapped.filter((item) => {
    return (
      item.title.toLowerCase().includes(search) ||
      item.summary.toLowerCase().includes(search) ||
      item.slug.toLowerCase().includes(search)
    );
  });
}
