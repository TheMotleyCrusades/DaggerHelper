import { mapCampaignInstallRow, mapInstallSuggestionRow } from "@/lib/content/mappers";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LineageCollision = {
  lineageKey: string;
  currentProductId: string;
  currentProductTitle: string;
  currentVersionId: string;
  incomingProductId: string;
  incomingProductTitle: string;
  incomingVersionId: string;
};

export async function detectLineageCollisions(params: {
  campaignId: number;
  productId: string;
  productVersionId: string;
}) {
  const [incomingProductResult, incomingVersionItemsResult, activeInstallsResult] =
    await Promise.all([
      supabaseAdmin
        .from("content_products")
        .select("id,title")
        .eq("id", params.productId)
        .maybeSingle(),
      supabaseAdmin
        .from("content_bundle_items")
        .select("lineage_key")
        .eq("product_version_id", params.productVersionId),
      supabaseAdmin
        .from("campaign_content_installs")
        .select("id,product_id,product_version_id,install_order")
        .eq("campaign_id", params.campaignId)
        .eq("is_archived", false)
        .order("install_order", { ascending: false }),
    ]);

  if (incomingProductResult.error) throw new Error(incomingProductResult.error.message);
  if (incomingVersionItemsResult.error) throw new Error(incomingVersionItemsResult.error.message);
  if (activeInstallsResult.error) throw new Error(activeInstallsResult.error.message);

  const incomingLineageKeys = new Set(
    ((incomingVersionItemsResult.data ?? []) as Array<{ lineage_key: string | null }>)
      .map((row) => row.lineage_key?.trim().toLowerCase() ?? "")
      .filter(Boolean)
  );
  if (!incomingLineageKeys.size) return [];

  const activeInstalls = (activeInstallsResult.data ?? []) as Array<{
    product_id: string;
    product_version_id: string;
    install_order: number;
  }>;
  if (!activeInstalls.length) return [];

  const activeVersionIds = activeInstalls.map((install) => install.product_version_id);
  const activeProductIds = Array.from(new Set(activeInstalls.map((install) => install.product_id)));
  const [activeItemsResult, activeProductsResult] = await Promise.all([
    supabaseAdmin
      .from("content_bundle_items")
      .select("product_version_id,lineage_key")
      .in("product_version_id", activeVersionIds),
    supabaseAdmin
      .from("content_products")
      .select("id,title")
      .in("id", activeProductIds),
  ]);

  if (activeItemsResult.error) throw new Error(activeItemsResult.error.message);
  if (activeProductsResult.error) throw new Error(activeProductsResult.error.message);

  const installByVersion = new Map(activeInstalls.map((install) => [install.product_version_id, install]));
  const productTitleById = new Map(
    ((activeProductsResult.data ?? []) as Array<{ id: string; title: string }>).map((row) => [row.id, row.title])
  );

  const highestPriorityByLineage = new Map<
    string,
    { productId: string; versionId: string; title: string; order: number }
  >();
  for (const row of (activeItemsResult.data ?? []) as Array<{
    product_version_id: string;
    lineage_key: string | null;
  }>) {
    const lineageKey = row.lineage_key?.trim().toLowerCase() ?? "";
    if (!lineageKey || !incomingLineageKeys.has(lineageKey)) continue;

    const install = installByVersion.get(row.product_version_id);
    if (!install) continue;
    const current = highestPriorityByLineage.get(lineageKey);
    if (!current || install.install_order > current.order) {
      highestPriorityByLineage.set(lineageKey, {
        productId: install.product_id,
        versionId: install.product_version_id,
        title: productTitleById.get(install.product_id) ?? install.product_id,
        order: install.install_order,
      });
    }
  }

  const incomingTitle = incomingProductResult.data?.title ?? params.productId;
  const collisions: LineageCollision[] = [];
  for (const [lineageKey, current] of highestPriorityByLineage.entries()) {
    collisions.push({
      lineageKey,
      currentProductId: current.productId,
      currentProductTitle: current.title,
      currentVersionId: current.versionId,
      incomingProductId: params.productId,
      incomingProductTitle: incomingTitle,
      incomingVersionId: params.productVersionId,
    });
  }

  collisions.sort((left, right) => left.lineageKey.localeCompare(right.lineageKey));
  return collisions;
}

export async function installProductVersionToCampaign(params: {
  campaignId: number;
  productId: string;
  productVersionId: string;
  installedByUserId: number;
  source?: string;
}) {
  const collisions = await detectLineageCollisions(params);
  const { data: currentOrderRow, error: orderError } = await supabaseAdmin
    .from("campaign_content_installs")
    .select("install_order")
    .eq("campaign_id", params.campaignId)
    .eq("is_archived", false)
    .order("install_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);

  const installOrder = Number(currentOrderRow?.install_order ?? 0) + 1;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("campaign_content_installs")
    .insert({
      campaign_id: params.campaignId,
      product_id: params.productId,
      product_version_id: params.productVersionId,
      installed_by_user_id: params.installedByUserId,
      install_order: installOrder,
      source: params.source ?? "install",
      is_archived: false,
      snapshot_payload: {
        installedAt: now,
        productId: params.productId,
        productVersionId: params.productVersionId,
      },
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to install product");

  return {
    install: mapCampaignInstallRow(data),
    collisions,
  };
}

export async function archiveCampaignInstall(params: {
  campaignId: number;
  installId: string;
  archivedByUserId: number;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("campaign_content_installs")
    .update({
      is_archived: true,
      archived_at: now,
      updated_at: now,
      snapshot_payload: {
        archivedAt: now,
        archivedByUserId: params.archivedByUserId,
      },
    })
    .eq("campaign_id", params.campaignId)
    .eq("id", params.installId)
    .eq("is_archived", false)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapCampaignInstallRow(data);
}

export async function createCampaignInstallSuggestion(params: {
  campaignId: number;
  suggestedByUserId: number;
  productId: string;
  productVersionId?: string | null;
  note?: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("campaign_install_suggestions")
    .insert({
      campaign_id: params.campaignId,
      suggested_by_user_id: params.suggestedByUserId,
      product_id: params.productId,
      product_version_id: params.productVersionId ?? null,
      note: params.note?.trim() ?? "",
      status: "pending",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create install suggestion");
  }
  return mapInstallSuggestionRow(data);
}

export async function listCampaignInstalls(campaignId: number) {
  const { data, error } = await supabaseAdmin
    .from("campaign_content_installs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("install_order", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapCampaignInstallRow(row));
}

export async function listCampaignInstallSuggestions(campaignId: number) {
  const { data, error } = await supabaseAdmin
    .from("campaign_install_suggestions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapInstallSuggestionRow(row));
}

export async function reviewCampaignInstallSuggestion(params: {
  campaignId: number;
  suggestionId: string;
  status: "approved" | "rejected";
  reviewedByUserId: number;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("campaign_install_suggestions")
    .update({
      status: params.status,
      reviewed_by_user_id: params.reviewedByUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("campaign_id", params.campaignId)
    .eq("id", params.suggestionId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapInstallSuggestionRow(data);
}
