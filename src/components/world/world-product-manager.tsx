"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ProductAccess = "free" | "paid";
type CatalogVisibility = "draft" | "listed" | "delisted";

type ProductRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  access: ProductAccess;
  visibility: CatalogVisibility;
  isHidden: boolean;
  updatedAt: string;
};

type ProductDraft = {
  title: string;
  summary: string;
  access: ProductAccess;
  visibility: CatalogVisibility;
  teaser: string;
};

const INITIAL_DRAFT: ProductDraft = {
  title: "",
  summary: "",
  access: "free",
  visibility: "draft",
  teaser: "",
};

function parseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as { error?: unknown };
  if (typeof data.error === "string") return data.error;
  return fallback;
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString();
}

export function WorldProductManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<ProductDraft>(INITIAL_DRAFT);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to load products."));
      }

      setProducts(payload as ProductRecord[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          access: draft.access,
          visibility: draft.visibility,
          teaser: draft.teaser.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to create product."));
      }

      setDraft(INITIAL_DRAFT);
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create product.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(
    product: ProductRecord,
    patch: Partial<Pick<ProductRecord, "access" | "visibility">>
  ) {
    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to update product."));
      }

      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update product.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product: ProductRecord) {
    const confirmed = confirm(`Delete ${product.title}? Draft versions and references will be removed.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to delete product."));
      }
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete product.");
    } finally {
      setSaving(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.summary.toLowerCase().includes(query)
      );
    });
  }, [products, filter]);

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
        <h2 className="text-2xl text-amber-300">World Creator Engine Bundles</h2>
        <p className="text-sm text-slate-300">
          Package mixed content kinds into product drafts and publish free listings for campaign install testing.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Paid listings stay blocked until the commerce phase is enabled.
        </p>
      </header>

      <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
        <h3 className="text-lg text-amber-200">Create Product Draft</h3>
        <form className="mt-3 grid gap-3" onSubmit={createProduct}>
          <label className="text-xs text-slate-300">
            Title
            <input
              className="field mt-1"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            Summary
            <textarea
              className="field mt-1 min-h-20"
              value={draft.summary}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            Teaser
            <textarea
              className="field mt-1 min-h-20"
              value={draft.teaser}
              onChange={(event) => setDraft((current) => ({ ...current, teaser: event.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-300">
              Access
              <select
                className="field mt-1"
                value={draft.access}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, access: event.target.value as ProductAccess }))
                }
              >
                <option value="free">Free</option>
                <option value="paid">Paid (disabled for listing)</option>
              </select>
            </label>
            <label className="text-xs text-slate-300">
              Visibility
              <select
                className="field mt-1"
                value={draft.visibility}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, visibility: event.target.value as CatalogVisibility }))
                }
              >
                <option value="draft">Draft</option>
                <option value="listed">Listed</option>
                <option value="delisted">Delisted</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary min-h-11 px-3 py-2 text-sm" type="submit" disabled={saving}>
              Create Product
            </button>
            <button
              className="btn-outline min-h-11 px-3 py-2 text-sm"
              type="button"
              onClick={() => setDraft(INITIAL_DRAFT)}
              disabled={saving}
            >
              Reset
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg text-amber-200">My Products</h3>
            <p className="text-xs text-slate-400">Use a product detail page to manage versions, bundle items, and docs.</p>
          </div>
          <label className="text-xs text-slate-300">
            Search
            <input
              className="field mt-1"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find product"
            />
          </label>
        </div>

        {loading && <p className="text-sm text-slate-300">Loading products...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !filteredProducts.length && (
          <p className="text-sm text-slate-400">No products yet.</p>
        )}

        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <article key={product.id} className="rounded-lg border border-slate-700/45 bg-slate-950/55 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base text-amber-100">{product.title}</p>
                  <p className="text-xs text-slate-500">slug: {product.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/world/bundles/${product.id}`} className="btn-outline min-h-11 px-3 py-2 text-xs">
                    Open Editor
                  </Link>
                  <button
                    className="rounded-md border border-red-400/45 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
                    type="button"
                    onClick={() => void archiveProduct(product)}
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {product.summary && <p className="mt-2 text-sm text-slate-300">{product.summary}</p>}
              <p className="mt-2 text-xs text-slate-500">Updated: {formatTimestamp(product.updatedAt)}</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-300">
                  Access
                  <select
                    className="field mt-1"
                    value={product.access}
                    onChange={(event) =>
                      void updateProduct(product, { access: event.target.value as ProductAccess })
                    }
                    disabled={saving}
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </label>

                <label className="text-xs text-slate-300">
                  Visibility
                  <select
                    className="field mt-1"
                    value={product.visibility}
                    onChange={(event) =>
                      void updateProduct(product, { visibility: event.target.value as CatalogVisibility })
                    }
                    disabled={saving}
                  >
                    <option value="draft">Draft</option>
                    <option value="listed">Listed</option>
                    <option value="delisted">Delisted</option>
                  </select>
                </label>
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
