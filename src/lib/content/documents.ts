import { mapDocumentRow } from "@/lib/content/mappers";
import { getProductById } from "@/lib/content/queries";
import type { ContentDocumentRecord, DocumentVisibility } from "@/lib/content/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function listProductDocuments(params: {
  productId: string;
  productVersionId: string;
  viewerUserId?: number | null;
  includeTeaserOnlyWhenNoEntitlement?: boolean;
}) {
  const product = await getProductById(params.viewerUserId ?? 0, params.productId, true);
  if (!product) return [];

  const { data, error } = await supabaseAdmin
    .from("content_documents")
    .select("*")
    .eq("product_version_id", params.productVersionId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const docs = ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapDocumentRow(row));
  const viewerId = params.viewerUserId ?? null;
  if (!viewerId) {
    return docs.filter((doc) => doc.visibility === "public_teaser");
  }

  const { data: entitlement, error: entitlementError } = await supabaseAdmin
    .from("user_content_entitlements")
    .select("id")
    .eq("user_id", viewerId)
    .eq("product_id", params.productId)
    .eq("status", "active")
    .maybeSingle();
  if (entitlementError) throw new Error(entitlementError.message);

  const entitled = Boolean(entitlement);
  if (entitled) return docs;
  if (params.includeTeaserOnlyWhenNoEntitlement ?? true) {
    return docs.filter((doc) => doc.visibility === "public_teaser");
  }
  return [];
}

export async function createProductDocument(params: {
  productVersionId: string;
  slug: string;
  title: string;
  bodyMarkdown?: string;
  teaserMarkdown?: string;
  visibility?: DocumentVisibility;
  parentDocumentId?: string | null;
  sortOrder?: number;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("content_documents")
    .insert({
      product_version_id: params.productVersionId,
      parent_document_id: params.parentDocumentId ?? null,
      slug: params.slug,
      title: params.title,
      body_markdown: params.bodyMarkdown ?? "",
      teaser_markdown: params.teaserMarkdown ?? "",
      visibility: params.visibility ?? "entitled_full",
      sort_order: params.sortOrder ?? 0,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create document");
  return mapDocumentRow(data);
}

export async function updateProductDocument(params: {
  id: string;
  patch: Partial<{
    slug: string;
    title: string;
    bodyMarkdown: string;
    teaserMarkdown: string;
    visibility: DocumentVisibility;
    parentDocumentId: string | null;
    sortOrder: number;
  }>;
}) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.patch.slug !== undefined) updates.slug = params.patch.slug;
  if (params.patch.title !== undefined) updates.title = params.patch.title;
  if (params.patch.bodyMarkdown !== undefined) updates.body_markdown = params.patch.bodyMarkdown;
  if (params.patch.teaserMarkdown !== undefined) updates.teaser_markdown = params.patch.teaserMarkdown;
  if (params.patch.visibility !== undefined) updates.visibility = params.patch.visibility;
  if (params.patch.parentDocumentId !== undefined) updates.parent_document_id = params.patch.parentDocumentId;
  if (params.patch.sortOrder !== undefined) updates.sort_order = params.patch.sortOrder;

  const { data, error } = await supabaseAdmin
    .from("content_documents")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDocumentRow(data);
}

export async function deleteProductDocument(id: string) {
  const { error } = await supabaseAdmin.from("content_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function buildDocumentTree(documents: ContentDocumentRecord[]) {
  const byParent = new Map<string | null, ContentDocumentRecord[]>();
  for (const doc of documents) {
    const parentId = doc.parentDocumentId ?? null;
    const existing = byParent.get(parentId) ?? [];
    existing.push(doc);
    byParent.set(parentId, existing);
  }
  for (const list of byParent.values()) {
    list.sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  }

  function build(parentId: string | null): Array<{
    document: ContentDocumentRecord;
    children: ReturnType<typeof build>;
  }> {
    const list = byParent.get(parentId) ?? [];
    return list.map((doc) => ({
      document: doc,
      children: build(doc.id),
    }));
  }

  return build(null);
}
