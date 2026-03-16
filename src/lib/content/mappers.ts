import type {
  CampaignContentInstallRecord,
  CampaignInstallSuggestionRecord,
  ContentBundleItemRecord,
  ContentDocumentRecord,
  ContentProductRecord,
  ContentProductVersionRecord,
  ContentReportRecord,
  HomebrewEntityRecord,
  ModerationActionRecord,
  UserContentEntitlementRecord,
} from "@/lib/content/types";

function toString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function toNullableInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function toBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function mapHomebrewEntityRow(row: Record<string, unknown>): HomebrewEntityRecord {
  return {
    id: toString(row.id),
    lineageKey: toString(row.lineage_key),
    entityKind: toString(row.entity_kind),
    scope: toString(row.scope, "personal") as HomebrewEntityRecord["scope"],
    ownerUserId: toNullableInt(row.owner_user_id),
    campaignId: toNullableInt(row.campaign_id),
    slug: toString(row.slug),
    name: toString(row.name),
    description: toString(row.description),
    payload: toRecord(row.payload),
    tags: toStringArray(row.tags),
    sourceProductId: row.source_product_id ? toString(row.source_product_id) : null,
    sourceProductVersionId: row.source_product_version_id
      ? toString(row.source_product_version_id)
      : null,
    isArchived: toBool(row.is_archived),
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapContentProductRow(row: Record<string, unknown>): ContentProductRecord {
  return {
    id: toString(row.id),
    ownerUserId: toNullableInt(row.owner_user_id),
    publisher: toString(row.publisher, "creator") as ContentProductRecord["publisher"],
    access: toString(row.access, "free") as ContentProductRecord["access"],
    visibility: toString(row.visibility, "draft") as ContentProductRecord["visibility"],
    title: toString(row.title),
    slug: toString(row.slug),
    summary: toString(row.summary),
    coverImageUrl: row.cover_image_url ? toString(row.cover_image_url) : null,
    teaser: toString(row.teaser),
    isHidden: toBool(row.is_hidden),
    stripeProductId: row.stripe_product_id ? toString(row.stripe_product_id) : null,
    stripeAccountId: row.stripe_account_id ? toString(row.stripe_account_id) : null,
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapContentVersionRow(row: Record<string, unknown>): ContentProductVersionRecord {
  return {
    id: toString(row.id),
    productId: toString(row.product_id),
    versionNumber: toInt(row.version_number, 1),
    versionLabel: toString(row.version_label),
    releaseNotes: toString(row.release_notes),
    isPublished: toBool(row.is_published),
    publishedAt: row.published_at ? toString(row.published_at) : null,
    snapshotPayload: toRecord(row.snapshot_payload),
    stripePriceId: row.stripe_price_id ? toString(row.stripe_price_id) : null,
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapBundleItemRow(row: Record<string, unknown>): ContentBundleItemRecord {
  return {
    id: toString(row.id),
    productVersionId: toString(row.product_version_id),
    entityKind: toString(row.entity_kind),
    sourceEntityId: row.source_entity_id ? toString(row.source_entity_id) : null,
    sourceTable: row.source_table ? toString(row.source_table) : null,
    lineageKey: row.lineage_key ? toString(row.lineage_key) : null,
    payload: toRecord(row.payload),
    sortOrder: toInt(row.sort_order, 0),
    createdAt: toString(row.created_at),
  };
}

export function mapDocumentRow(row: Record<string, unknown>): ContentDocumentRecord {
  return {
    id: toString(row.id),
    productVersionId: toString(row.product_version_id),
    parentDocumentId: row.parent_document_id ? toString(row.parent_document_id) : null,
    slug: toString(row.slug),
    title: toString(row.title),
    bodyMarkdown: toString(row.body_markdown),
    teaserMarkdown: toString(row.teaser_markdown),
    visibility: toString(row.visibility, "entitled_full") as ContentDocumentRecord["visibility"],
    sortOrder: toInt(row.sort_order, 0),
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapEntitlementRow(row: Record<string, unknown>): UserContentEntitlementRecord {
  return {
    id: toString(row.id),
    userId: toInt(row.user_id),
    productId: toString(row.product_id),
    productVersionId: row.product_version_id ? toString(row.product_version_id) : null,
    source: toString(row.source, "claim") as UserContentEntitlementRecord["source"],
    status: toString(row.status, "active") as UserContentEntitlementRecord["status"],
    grantedAt: toString(row.granted_at),
    revokedAt: row.revoked_at ? toString(row.revoked_at) : null,
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapCampaignInstallRow(row: Record<string, unknown>): CampaignContentInstallRecord {
  return {
    id: toString(row.id),
    campaignId: toInt(row.campaign_id),
    productId: toString(row.product_id),
    productVersionId: toString(row.product_version_id),
    installedByUserId: toInt(row.installed_by_user_id),
    installOrder: toInt(row.install_order, 0),
    source: toString(row.source),
    isArchived: toBool(row.is_archived),
    archivedAt: row.archived_at ? toString(row.archived_at) : null,
    snapshotPayload: toRecord(row.snapshot_payload),
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapInstallSuggestionRow(
  row: Record<string, unknown>
): CampaignInstallSuggestionRecord {
  return {
    id: toString(row.id),
    campaignId: toInt(row.campaign_id),
    suggestedByUserId: toInt(row.suggested_by_user_id),
    productId: toString(row.product_id),
    productVersionId: row.product_version_id ? toString(row.product_version_id) : null,
    note: toString(row.note),
    status: toString(row.status, "pending") as CampaignInstallSuggestionRecord["status"],
    reviewedByUserId: toNullableInt(row.reviewed_by_user_id),
    reviewedAt: row.reviewed_at ? toString(row.reviewed_at) : null,
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapReportRow(row: Record<string, unknown>): ContentReportRecord {
  return {
    id: toString(row.id),
    reporterUserId: toInt(row.reporter_user_id),
    productId: row.product_id ? toString(row.product_id) : null,
    entityKind: row.entity_kind ? toString(row.entity_kind) : null,
    entityId: row.entity_id ? toString(row.entity_id) : null,
    reason: toString(row.reason),
    details: toString(row.details),
    status: toString(row.status, "open") as ContentReportRecord["status"],
    createdAt: toString(row.created_at),
    updatedAt: toString(row.updated_at),
  };
}

export function mapModerationActionRow(row: Record<string, unknown>): ModerationActionRecord {
  return {
    id: toString(row.id),
    reportId: row.report_id ? toString(row.report_id) : null,
    targetProductId: row.target_product_id ? toString(row.target_product_id) : null,
    targetEntityKind: row.target_entity_kind ? toString(row.target_entity_kind) : null,
    targetEntityId: row.target_entity_id ? toString(row.target_entity_id) : null,
    action: toString(row.action, "dismiss") as ModerationActionRecord["action"],
    note: toString(row.note),
    actedByUserId: toInt(row.acted_by_user_id),
    createdAt: toString(row.created_at),
  };
}
