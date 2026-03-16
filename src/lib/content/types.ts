export type ContentScope = "official" | "personal" | "campaign";
export type PublisherType = "official" | "creator";
export type ProductAccess = "free" | "paid";
export type CatalogVisibility = "draft" | "listed" | "delisted";
export type DocumentVisibility = "public_teaser" | "entitled_full";

export type HomebrewEntityRecord = {
  id: string;
  lineageKey: string;
  entityKind: string;
  scope: ContentScope;
  ownerUserId: number | null;
  campaignId: number | null;
  slug: string;
  name: string;
  description: string;
  payload: Record<string, unknown>;
  tags: string[];
  sourceProductId: string | null;
  sourceProductVersionId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContentProductRecord = {
  id: string;
  ownerUserId: number | null;
  publisher: PublisherType;
  access: ProductAccess;
  visibility: CatalogVisibility;
  title: string;
  slug: string;
  summary: string;
  coverImageUrl: string | null;
  teaser: string;
  isHidden: boolean;
  stripeProductId: string | null;
  stripeAccountId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentProductVersionRecord = {
  id: string;
  productId: string;
  versionNumber: number;
  versionLabel: string;
  releaseNotes: string;
  isPublished: boolean;
  publishedAt: string | null;
  snapshotPayload: Record<string, unknown>;
  stripePriceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentBundleItemRecord = {
  id: string;
  productVersionId: string;
  entityKind: string;
  sourceEntityId: string | null;
  sourceTable: string | null;
  lineageKey: string | null;
  payload: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
};

export type ContentDocumentRecord = {
  id: string;
  productVersionId: string;
  parentDocumentId: string | null;
  slug: string;
  title: string;
  bodyMarkdown: string;
  teaserMarkdown: string;
  visibility: DocumentVisibility;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UserContentEntitlementRecord = {
  id: string;
  userId: number;
  productId: string;
  productVersionId: string | null;
  source: "claim" | "purchase" | "grant" | "import";
  status: "active" | "revoked";
  grantedAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignContentInstallRecord = {
  id: string;
  campaignId: number;
  productId: string;
  productVersionId: string;
  installedByUserId: number;
  installOrder: number;
  source: string;
  isArchived: boolean;
  archivedAt: string | null;
  snapshotPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CampaignInstallSuggestionRecord = {
  id: string;
  campaignId: number;
  suggestedByUserId: number;
  productId: string;
  productVersionId: string | null;
  note: string;
  status: "pending" | "approved" | "rejected";
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentReportRecord = {
  id: string;
  reporterUserId: number;
  productId: string | null;
  entityKind: string | null;
  entityId: string | null;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  updatedAt: string;
};

export type ModerationActionRecord = {
  id: string;
  reportId: string | null;
  targetProductId: string | null;
  targetEntityKind: string | null;
  targetEntityId: string | null;
  action: "dismiss" | "warn" | "delist" | "restrict";
  note: string;
  actedByUserId: number;
  createdAt: string;
};

export type ProductCreateInput = {
  title: string;
  slug?: string;
  summary?: string;
  access?: ProductAccess;
  visibility?: CatalogVisibility;
  teaser?: string;
  isHidden?: boolean;
};

export type ProductUpdateInput = Partial<ProductCreateInput> & {
  coverImageUrl?: string | null;
  stripeProductId?: string | null;
  stripeAccountId?: string | null;
};

export type ProductVersionCreateInput = {
  versionLabel?: string;
  releaseNotes?: string;
  isPublished?: boolean;
  snapshotPayload?: Record<string, unknown>;
  stripePriceId?: string | null;
};

export type HomebrewEntityCreateInput = {
  entityKind: string;
  scope?: ContentScope;
  campaignId?: number | null;
  lineageKey?: string;
  slug?: string;
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
  tags?: string[];
};

export type HomebrewEntityUpdateInput = Partial<HomebrewEntityCreateInput> & {
  isArchived?: boolean;
};

export type CatalogListFilters = {
  visibility?: CatalogVisibility;
  access?: ProductAccess;
  search?: string;
  ownerUserId?: number;
  includeHidden?: boolean;
};
