"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type CatalogProduct = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  access: "free" | "paid";
  visibility: "draft" | "listed" | "delisted";
  entitled?: boolean;
};

function parseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { error?: unknown };
  if (typeof body.error === "string") return body.error;
  return fallback;
}

export function ContentCatalog() {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | "free" | "paid">("all");
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ catalog: "true" });
        if (search.trim()) params.set("search", search.trim());
        if (accessFilter !== "all") params.set("access", accessFilter);

        const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(parseError(payload, "Failed to load catalog."));
        }

        if (cancelled) return;
        setProducts(payload as CatalogProduct[]);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load catalog.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [accessFilter, search, user?.id]);

  async function claimProduct(product: CatalogProduct) {
    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}/claim`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to claim product."));
      }

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, entitled: true } : item))
      );
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Failed to claim product.");
    } finally {
      setSaving(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput);
  }

  const groupedCounts = useMemo(() => {
    return {
      total: products.length,
      free: products.filter((product) => product.access === "free").length,
      paid: products.filter((product) => product.access === "paid").length,
    };
  }, [products]);

  return (
    <section className="space-y-4 rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
      <header>
        <h2 className="text-xl text-amber-200">Community Content Catalog</h2>
        <p className="text-sm text-slate-300">
          Browse listed content packs. Free packs can be claimed to unlock full entitled documents.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        <span>Total: {groupedCounts.total}</span>
        <span>Free: {groupedCounts.free}</span>
        <span>Paid: {groupedCounts.paid}</span>
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={submitSearch}>
        <input
          className="field"
          placeholder="Search products"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <select
          className="field"
          value={accessFilter}
          onChange={(event) => setAccessFilter(event.target.value as "all" | "free" | "paid")}
        >
          <option value="all">All Access</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <button className="btn-outline min-h-11 px-3 py-2 text-sm" type="submit">
          Search
        </button>
      </form>

      {!authLoading && !user && (
        <p className="text-xs text-slate-400">
          Sign in to claim free products and submit reports.
        </p>
      )}

      {loading && <p className="text-sm text-slate-300">Loading catalog...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !products.length && <p className="text-sm text-slate-400">No catalog entries found.</p>}

      <div className="space-y-3">
        {products.map((product) => (
          <article key={product.id} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base text-amber-100">{product.title}</p>
                <p className="text-xs text-slate-500">/{product.slug}</p>
                {product.summary && <p className="mt-1 text-sm text-slate-300">{product.summary}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded border border-slate-600/60 px-2 py-1 text-[11px] text-slate-200">
                  {product.access}
                </span>
                <Link
                  href={`/community/products/${product.id}`}
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                >
                  Open Details
                </Link>
                {product.access === "free" && (
                  <button
                    className="btn-primary min-h-11 px-3 py-2 text-xs"
                    onClick={() => void claimProduct(product)}
                    disabled={Boolean(product.entitled) || saving || !user}
                    type="button"
                  >
                    {product.entitled ? "Claimed" : "Claim Free"}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
