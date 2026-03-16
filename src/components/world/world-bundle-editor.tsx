"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ProductAccess = "free" | "paid";
type CatalogVisibility = "draft" | "listed" | "delisted";
type DocumentVisibility = "public_teaser" | "entitled_full";

type ProductRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  teaser: string;
  access: ProductAccess;
  visibility: CatalogVisibility;
  isHidden: boolean;
  updatedAt: string;
};

type VersionRecord = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  releaseNotes: string;
  isPublished: boolean;
  createdAt: string;
};

type ContentEntry = {
  id: string;
  lineageKey: string;
  entityKind: string;
  name: string;
};

type BundleItemRecord = {
  id: string;
  entityKind: string;
  sourceEntityId: string | null;
  sourceTable: string | null;
  lineageKey: string | null;
  payload: Record<string, unknown>;
  sortOrder: number;
};

type BundleItemDraft = {
  key: string;
  entityKind: string;
  sourceEntityId: string | null;
  sourceTable: string | null;
  lineageKey: string | null;
  payload: Record<string, unknown>;
};

type DocumentRecord = {
  id: string;
  slug: string;
  title: string;
  visibility: DocumentVisibility;
  teaserMarkdown: string;
  bodyMarkdown: string;
  sortOrder: number;
  updatedAt: string;
};

type ProductDraft = {
  title: string;
  summary: string;
  teaser: string;
  access: ProductAccess;
  visibility: CatalogVisibility;
  isHidden: boolean;
};

type DocumentDraft = {
  slug: string;
  title: string;
  visibility: DocumentVisibility;
  teaserMarkdown: string;
  bodyMarkdown: string;
};

const EMPTY_DOCUMENT: DocumentDraft = {
  slug: "",
  title: "",
  visibility: "entitled_full",
  teaserMarkdown: "",
  bodyMarkdown: "",
};

function parseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { error?: unknown };
  if (typeof body.error === "string") return body.error;
  return fallback;
}

function toKey(item: BundleItemRecord) {
  return item.id;
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString();
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function WorldBundleEditor({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);

  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

  const [contentEntries, setContentEntries] = useState<ContentEntry[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleItemDraft[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [selectedContentId, setSelectedContentId] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [versionNotes, setVersionNotes] = useState("");
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(EMPTY_DOCUMENT);

  const loadVersionData = useCallback(async (versionId: string) => {
    try {
      const [bundleResponse, docsResponse] = await Promise.all([
        fetch(`/api/products/${productId}/versions/${versionId}/bundle-items`, { cache: "no-store" }),
        fetch(`/api/products/${productId}/versions/${versionId}/documents`, { cache: "no-store" }),
      ]);

      const bundlePayload = await bundleResponse.json();
      if (!bundleResponse.ok) {
        throw new Error(parseError(bundlePayload, "Failed to load bundle items."));
      }

      const docsPayload = await docsResponse.json();
      if (!docsResponse.ok) {
        throw new Error(parseError(docsPayload, "Failed to load documents."));
      }

      const loadedItems = (bundlePayload as BundleItemRecord[])
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => ({
          key: toKey(item),
          entityKind: item.entityKind,
          sourceEntityId: item.sourceEntityId,
          sourceTable: item.sourceTable,
          lineageKey: item.lineageKey,
          payload: item.payload,
        }));

      setBundleItems(loadedItems);
      setDocuments(docsPayload as DocumentRecord[]);
      setError(null);
    } catch (versionError) {
      setError(versionError instanceof Error ? versionError.message : "Failed to load version data.");
    }
  }, [productId]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [productResponse, versionsResponse, contentResponse] = await Promise.all([
        fetch(`/api/products/${productId}`, { cache: "no-store" }),
        fetch(`/api/products/${productId}/versions`, { cache: "no-store" }),
        fetch("/api/content?scope=personal", { cache: "no-store" }),
      ]);

      const productPayload = await productResponse.json();
      if (!productResponse.ok) {
        throw new Error(parseError(productPayload, "Failed to load product."));
      }

      const versionsPayload = await versionsResponse.json();
      if (!versionsResponse.ok) {
        throw new Error(parseError(versionsPayload, "Failed to load versions."));
      }

      const contentPayload = await contentResponse.json();
      if (!contentResponse.ok) {
        throw new Error(parseError(contentPayload, "Failed to load content entries."));
      }

      const loadedProduct = productPayload as ProductRecord;
      const loadedVersions = (versionsPayload as VersionRecord[]).sort(
        (left, right) => right.versionNumber - left.versionNumber
      );

      setProduct(loadedProduct);
      setProductDraft({
        title: loadedProduct.title,
        summary: loadedProduct.summary,
        teaser: loadedProduct.teaser,
        access: loadedProduct.access,
        visibility: loadedProduct.visibility,
        isHidden: loadedProduct.isHidden,
      });
      setVersions(loadedVersions);
      setContentEntries(contentPayload as ContentEntry[]);

      if (loadedVersions.length) {
        setSelectedVersionId((current) =>
          current && loadedVersions.some((version) => version.id === current)
            ? current
            : loadedVersions[0].id
        );
      } else {
        setSelectedVersionId("");
        setBundleItems([]);
        setDocuments([]);
      }

      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load bundle editor.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!selectedVersionId) return;
    void loadVersionData(selectedVersionId);
  }, [loadVersionData, selectedVersionId]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product || !productDraft) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: productDraft.title.trim(),
          summary: productDraft.summary.trim(),
          teaser: productDraft.teaser.trim(),
          access: productDraft.access,
          visibility: productDraft.visibility,
          isHidden: productDraft.isHidden,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to update product."));
      }

      await loadBase();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update product.");
    } finally {
      setSaving(false);
    }
  }

  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/products/${productId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionLabel: versionLabel.trim(),
          releaseNotes: versionNotes.trim(),
          isPublished: false,
          snapshotPayload: {},
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to create version."));
      }

      setVersionLabel("");
      setVersionNotes("");
      await loadBase();
      if ((payload as VersionRecord).id) {
        setSelectedVersionId((payload as VersionRecord).id);
      }
    } catch (versionError) {
      setError(versionError instanceof Error ? versionError.message : "Failed to create version.");
    } finally {
      setSaving(false);
    }
  }

  function addSelectedContentToBundle() {
    const source = contentEntries.find((entry) => entry.id === selectedContentId);
    if (!source) return;

    setBundleItems((current) => [
      ...current,
      {
        key: `draft-${source.id}-${current.length + 1}`,
        entityKind: source.entityKind,
        sourceEntityId: source.id,
        sourceTable: "homebrew_entities",
        lineageKey: source.lineageKey,
        payload: {},
      },
    ]);
    setSelectedContentId("");
  }

  function removeBundleItem(index: number) {
    setBundleItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveBundleItem(index: number, direction: -1 | 1) {
    setBundleItems((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  async function saveBundleItems() {
    if (!selectedVersionId) {
      setError("Create a version before saving bundle items.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/products/${productId}/versions/${selectedVersionId}/bundle-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bundleItems.map((item, index) => ({
            entityKind: item.entityKind,
            sourceEntityId: item.sourceEntityId,
            sourceTable: item.sourceTable,
            lineageKey: item.lineageKey,
            payload: item.payload,
            sortOrder: index,
          }))
        ),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to save bundle items."));
      }

      await loadVersionData(selectedVersionId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save bundle items.");
    } finally {
      setSaving(false);
    }
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVersionId) {
      setError("Create a version before adding documents.");
      return;
    }
    if (!documentDraft.title.trim()) {
      setError("Document title is required.");
      return;
    }

    const slug = normalizeSlug(documentDraft.slug || documentDraft.title);
    if (!slug) {
      setError("Document slug is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/products/${productId}/versions/${selectedVersionId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: documentDraft.title.trim(),
          visibility: documentDraft.visibility,
          teaserMarkdown: documentDraft.teaserMarkdown,
          bodyMarkdown: documentDraft.bodyMarkdown,
          sortOrder: documents.length,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to create document."));
      }

      setDocumentDraft(EMPTY_DOCUMENT);
      await loadVersionData(selectedVersionId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create document.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!selectedVersionId) return;

    const confirmed = confirm("Delete this document?");
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/products/${productId}/versions/${selectedVersionId}/documents/${id}`,
        {
          method: "DELETE",
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to delete document."));
      }

      await loadVersionData(selectedVersionId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete document.");
    } finally {
      setSaving(false);
    }
  }

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  const kindSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of bundleItems) {
      counts.set(item.entityKind, (counts.get(item.entityKind) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [bundleItems]);

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
        <h2 className="text-2xl text-amber-300">Bundle Editor</h2>
        <p className="text-sm text-slate-300">
          Manage product details, immutable versions, bundle composition, and entitlement documents.
        </p>
      </header>

      {loading && <p className="text-sm text-slate-300">Loading bundle editor...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !product && <p className="text-sm text-red-400">Product not found.</p>}

      {product && productDraft && (
        <>
          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <h3 className="text-lg text-amber-200">Product Details</h3>
            <form className="mt-3 grid gap-3" onSubmit={saveProduct}>
              <label className="text-xs text-slate-300">
                Title
                <input
                  className="field mt-1"
                  value={productDraft.title}
                  onChange={(event) =>
                    setProductDraft((current) => (current ? { ...current, title: event.target.value } : current))
                  }
                  required
                />
              </label>
              <label className="text-xs text-slate-300">
                Summary
                <textarea
                  className="field mt-1 min-h-20"
                  value={productDraft.summary}
                  onChange={(event) =>
                    setProductDraft((current) => (current ? { ...current, summary: event.target.value } : current))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Teaser
                <textarea
                  className="field mt-1 min-h-20"
                  value={productDraft.teaser}
                  onChange={(event) =>
                    setProductDraft((current) => (current ? { ...current, teaser: event.target.value } : current))
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-slate-300">
                  Access
                  <select
                    className="field mt-1"
                    value={productDraft.access}
                    onChange={(event) =>
                      setProductDraft((current) =>
                        current ? { ...current, access: event.target.value as ProductAccess } : current
                      )
                    }
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </label>
                <label className="text-xs text-slate-300">
                  Visibility
                  <select
                    className="field mt-1"
                    value={productDraft.visibility}
                    onChange={(event) =>
                      setProductDraft((current) =>
                        current ? { ...current, visibility: event.target.value as CatalogVisibility } : current
                      )
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="listed">Listed</option>
                    <option value="delisted">Delisted</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    checked={productDraft.isHidden}
                    onChange={(event) =>
                      setProductDraft((current) =>
                        current ? { ...current, isHidden: event.target.checked } : current
                      )
                    }
                    type="checkbox"
                  />
                  Hide from catalog
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-primary min-h-11 px-3 py-2 text-sm" type="submit" disabled={saving}>
                  Save Product
                </button>
                <p className="text-xs text-slate-500">Last update: {formatTimestamp(product.updatedAt)}</p>
              </div>
            </form>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg text-amber-200">Versions</h3>
                <p className="text-xs text-slate-400">Versions are immutable snapshots for installable content.</p>
              </div>
              {selectedVersion && (
                <p className="text-xs text-slate-500">
                  Active: {selectedVersion.versionLabel} (v{selectedVersion.versionNumber})
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
              <form className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3" onSubmit={createVersion}>
                <h4 className="text-sm text-amber-100">Create Version</h4>
                <label className="mt-2 block text-xs text-slate-300">
                  Version Label
                  <input
                    className="field mt-1"
                    value={versionLabel}
                    onChange={(event) => setVersionLabel(event.target.value)}
                    placeholder="v1, launch-beta, etc."
                  />
                </label>
                <label className="mt-2 block text-xs text-slate-300">
                  Release Notes
                  <textarea
                    className="field mt-1 min-h-16"
                    value={versionNotes}
                    onChange={(event) => setVersionNotes(event.target.value)}
                  />
                </label>
                <button className="btn-primary mt-3 min-h-11 px-3 py-2 text-xs" type="submit" disabled={saving}>
                  Create Version
                </button>
              </form>

              <div className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
                <h4 className="text-sm text-amber-100">Available Versions</h4>
                {versions.length ? (
                  <div className="mt-2 space-y-2">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        className={`block w-full rounded-md border px-3 py-2 text-left text-xs ${
                          version.id === selectedVersionId
                            ? "border-amber-500/45 bg-amber-900/25 text-amber-100"
                            : "border-slate-700/50 bg-slate-900/70 text-slate-300"
                        }`}
                        onClick={() => setSelectedVersionId(version.id)}
                        type="button"
                      >
                        {version.versionLabel || `v${version.versionNumber}`} (v{version.versionNumber})
                        <span className="block text-[11px] text-slate-400">
                          {version.isPublished ? "published" : "draft"} · {formatTimestamp(version.createdAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No versions yet.</p>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <h3 className="text-lg text-amber-200">Bundle Items</h3>
            <p className="text-xs text-slate-400">
              Add mixed content kinds from your personal draft library and save the selected version payload.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="text-xs text-slate-300">
                Add From Personal Content
                <select
                  className="field mt-1"
                  value={selectedContentId}
                  onChange={(event) => setSelectedContentId(event.target.value)}
                  disabled={!selectedVersionId}
                >
                  <option value="">Select content entry</option>
                  {contentEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.entityKind})
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn-outline min-h-11 px-3 py-2 text-xs"
                type="button"
                onClick={addSelectedContentToBundle}
                disabled={!selectedVersionId || !selectedContentId}
              >
                Add Item
              </button>
            </div>

            {kindSummary.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {kindSummary.map(([kind, count]) => (
                  <span
                    key={`${kind}-${count}`}
                    className="rounded border border-slate-600/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-200"
                  >
                    {kind}: {count}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {bundleItems.map((item, index) => {
                const source = item.sourceEntityId
                  ? contentEntries.find((entry) => entry.id === item.sourceEntityId)
                  : null;

                return (
                  <article key={`${item.key}-${index}`} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-amber-100">{source?.name ?? item.lineageKey ?? item.entityKind}</p>
                        <p className="text-xs text-slate-500">
                          kind: {item.entityKind} {item.lineageKey ? `· lineage: ${item.lineageKey}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-outline min-h-11 px-2 py-1 text-[11px]"
                          type="button"
                          onClick={() => moveBundleItem(index, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          className="btn-outline min-h-11 px-2 py-1 text-[11px]"
                          type="button"
                          onClick={() => moveBundleItem(index, 1)}
                          disabled={index === bundleItems.length - 1}
                        >
                          Down
                        </button>
                        <button
                          className="rounded-md border border-red-400/45 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/30"
                          type="button"
                          onClick={() => removeBundleItem(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!bundleItems.length && (
              <p className="mt-3 text-sm text-slate-400">No items in this version yet.</p>
            )}

            <button
              className="btn-primary mt-3 min-h-11 px-3 py-2 text-sm"
              type="button"
              onClick={() => void saveBundleItems()}
              disabled={!selectedVersionId || saving}
            >
              Save Bundle Items
            </button>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <h3 className="text-lg text-amber-200">Documents</h3>
            <p className="text-xs text-slate-400">
              Add teaser and entitled markdown pages for this version. Public users only see teaser docs.
            </p>

            <form className="mt-3 grid gap-2 rounded-md border border-slate-700/45 bg-slate-950/55 p-3" onSubmit={createDocument}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-300">
                  Title
                  <input
                    className="field mt-1"
                    value={documentDraft.title}
                    onChange={(event) =>
                      setDocumentDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Slug (optional)
                  <input
                    className="field mt-1"
                    value={documentDraft.slug}
                    onChange={(event) =>
                      setDocumentDraft((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="auto-from-title"
                  />
                </label>
              </div>

              <label className="text-xs text-slate-300">
                Visibility
                <select
                  className="field mt-1"
                  value={documentDraft.visibility}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({
                      ...current,
                      visibility: event.target.value as DocumentVisibility,
                    }))
                  }
                >
                  <option value="entitled_full">Entitled Full</option>
                  <option value="public_teaser">Public Teaser</option>
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Teaser Markdown
                <textarea
                  className="field mt-1 min-h-20"
                  value={documentDraft.teaserMarkdown}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({ ...current, teaserMarkdown: event.target.value }))
                  }
                />
              </label>

              <label className="text-xs text-slate-300">
                Body Markdown
                <textarea
                  className="field mt-1 min-h-28"
                  value={documentDraft.bodyMarkdown}
                  onChange={(event) =>
                    setDocumentDraft((current) => ({ ...current, bodyMarkdown: event.target.value }))
                  }
                />
              </label>

              <button className="btn-primary min-h-11 px-3 py-2 text-sm" type="submit" disabled={!selectedVersionId || saving}>
                Add Document
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {documents.map((document) => (
                <article key={document.id} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-amber-100">{document.title}</p>
                      <p className="text-xs text-slate-500">/{document.slug}</p>
                      <p className="text-xs text-slate-500">
                        {document.visibility} · updated {formatTimestamp(document.updatedAt)}
                      </p>
                    </div>
                    <button
                      className="rounded-md border border-red-400/45 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/30"
                      type="button"
                      onClick={() => void deleteDocument(document.id)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!documents.length && <p className="mt-2 text-sm text-slate-400">No documents added yet.</p>}
          </article>
        </>
      )}
    </section>
  );
}
