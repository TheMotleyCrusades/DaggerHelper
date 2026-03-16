import { z } from "zod";

export const contentScopeSchema = z.enum(["official", "personal", "campaign"]);
export const productAccessSchema = z.enum(["free", "paid"]);
export const catalogVisibilitySchema = z.enum(["draft", "listed", "delisted"]);
export const publisherTypeSchema = z.enum(["official", "creator"]);
export const documentVisibilitySchema = z.enum(["public_teaser", "entitled_full"]);

const slugSchema = z
  .string()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function defaultSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function defaultLineage(entityKind: string, name: string) {
  const base = defaultSlug(name) || "entity";
  return `${defaultSlug(entityKind) || "content"}-${base}`;
}

export const homebrewEntityCreateSchema = z
  .object({
    entityKind: z.string().min(1).max(120),
    scope: contentScopeSchema.default("personal"),
    campaignId: z.number().int().positive().nullable().optional(),
    lineageKey: z.string().min(1).max(180).optional(),
    slug: slugSchema.optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(4000).default(""),
    payload: z.record(z.string(), z.unknown()).default({}),
    tags: z.array(z.string().min(1).max(80)).default([]),
  })
  .transform((value) => {
    const slug = (value.slug ?? defaultSlug(value.name)) || "content-entry";
    return {
      ...value,
      slug,
      lineageKey: value.lineageKey ?? defaultLineage(value.entityKind, value.name),
    };
  });

export const homebrewEntityUpdateSchema = z.object({
  entityKind: z.string().min(1).max(120).optional(),
  scope: contentScopeSchema.optional(),
  campaignId: z.number().int().positive().nullable().optional(),
  lineageKey: z.string().min(1).max(180).optional(),
  slug: slugSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().min(1).max(80)).optional(),
  isArchived: z.boolean().optional(),
});

export const productCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    slug: slugSchema.optional(),
    summary: z.string().max(3000).default(""),
    access: productAccessSchema.default("free"),
    visibility: catalogVisibilitySchema.default("draft"),
    teaser: z.string().max(6000).default(""),
    isHidden: z.boolean().default(false),
  })
  .transform((value) => ({
    ...value,
    slug: (value.slug ?? defaultSlug(value.title)) || "content-product",
  }));

export const productUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: slugSchema.optional(),
  summary: z.string().max(3000).optional(),
  access: productAccessSchema.optional(),
  visibility: catalogVisibilitySchema.optional(),
  teaser: z.string().max(6000).optional(),
  isHidden: z.boolean().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  stripeProductId: z.string().max(200).nullable().optional(),
  stripeAccountId: z.string().max(200).nullable().optional(),
});

export const productVersionCreateSchema = z.object({
  versionLabel: z.string().max(120).default(""),
  releaseNotes: z.string().max(4000).default(""),
  isPublished: z.boolean().default(false),
  snapshotPayload: z.record(z.string(), z.unknown()).default({}),
  stripePriceId: z.string().max(200).nullable().optional(),
});

export const bundleItemSchema = z.object({
  entityKind: z.string().min(1).max(120),
  sourceEntityId: z.string().uuid().nullable().optional(),
  sourceTable: z.string().max(120).nullable().optional(),
  lineageKey: z.string().max(180).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().min(0).default(0),
});

export const documentCreateSchema = z.object({
  parentDocumentId: z.string().uuid().nullable().optional(),
  slug: slugSchema,
  title: z.string().min(1).max(200),
  bodyMarkdown: z.string().max(200000).default(""),
  teaserMarkdown: z.string().max(12000).default(""),
  visibility: documentVisibilitySchema.default("entitled_full"),
  sortOrder: z.number().int().min(0).default(0),
});

export const catalogQuerySchema = z.object({
  visibility: catalogVisibilitySchema.optional(),
  access: productAccessSchema.optional(),
  search: z.string().max(200).optional(),
  ownerUserId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
    }),
  includeHidden: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});
