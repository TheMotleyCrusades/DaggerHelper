"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdversaryCard } from "@/components/adversaries/adversary-card";
import { AdversaryStatBlock } from "@/components/adversaries/adversary-stat-block";
import { FavouriteToggle } from "@/components/adversaries/favourite-toggle";
import {
  SearchFilters,
  type CommunityFilters,
} from "@/components/adversaries/search-filters";

type CommunityAdversary = {
  id: number;
  name: string;
  tier: number;
  type: string;
  description?: string | null;
  tags?: string[];
  favouriteCount: number;
  favourited?: boolean;
  motives?: string | null;
  difficulty?: number | null;
  majorThreshold?: string | null;
  severeThreshold?: string | null;
  hp?: string | null;
  stress?: string | null;
  atk?: string | null;
  damageAverage?: string | null;
  weaponName?: string | null;
  weaponRange?: string | null;
  damageDice?: string | null;
  potentialDicePools?: string[] | null;
  features?: Array<{ name: string; type: string; description: string }> | null;
  experiences?: Array<{ phrase: string; value?: string }> | null;
};

const LIMIT = 18;

export function CommunityLibrary() {
  const [filters, setFilters] = useState<CommunityFilters>({
    search: "",
    type: "",
    tier: "",
    tags: "",
    sort: "newest",
  });
  const [items, setItems] = useState<CommunityAdversary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const requestInFlightRef = useRef(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.type) params.set("type", filters.type);
    if (filters.tier) params.set("tier", filters.tier);
    if (filters.tags) params.set("tags", filters.tags);
    params.set("sort", filters.sort);
    params.set("page", page.toString());
    params.set("limit", LIMIT.toString());
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let cancelled = false;
    requestInFlightRef.current = true;

    async function run() {
      try {
        const response = await fetch(`/api/adversaries/public?${queryString}`, { cache: "no-store" });
        const data = await response.json();

        if (cancelled) return;
        if (!response.ok) {
          setError(data.error ?? "Failed to load community adversaries");
          setLoading(false);
          return;
        }

        const nextItems = Array.isArray(data.items) ? (data.items as CommunityAdversary[]) : [];
        setItems((current) => (page === 1 ? nextItems : [...current, ...nextItems]));
        setHasMore(Boolean(data.hasMore));
        setError(null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Failed to load community adversaries");
        setLoading(false);
      } finally {
        requestInFlightRef.current = false;
      }
    }

    void run();
    return () => {
      cancelled = true;
      requestInFlightRef.current = false;
    };
  }, [page, queryString]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || requestInFlightRef.current) return;
        requestInFlightRef.current = true;
        setLoading(true);
        setPage((current) => current + 1);
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const applyFilters = useCallback((nextFilters: CommunityFilters) => {
    setLoading(true);
    setPage(1);
    setFilters(nextFilters);
    setPinnedId(null);
    setHoveredId(null);
  }, []);

  function loadMore() {
    if (!hasMore || loading || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setLoading(true);
    setPage((current) => current + 1);
  }

  function togglePinned(id: number) {
    setPinnedId((current) => (current === id ? null : id));
    setHoveredId(null);
  }

  const expandedId = pinnedId ?? hoveredId;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-2xl text-amber-300">Adversary Exchange</h2>
        <p className="text-sm text-slate-300">
          Browse public adversaries, filter by traits, and favourite useful stat blocks. Hover to preview on desktop, or tap Preview on touch devices.
        </p>
      </div>

      <SearchFilters onApply={applyFilters} />

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="space-y-3">
        {items.map((item) => {
          const expanded = expandedId === item.id;
          const pinned = pinnedId === item.id;

          return (
            <article
              key={item.id}
              className="space-y-2"
              onMouseEnter={() => {
                if (!pinnedId) setHoveredId(item.id);
              }}
              onMouseLeave={() => {
                if (!pinnedId) setHoveredId((current) => (current === item.id ? null : current));
              }}
            >
              <AdversaryCard
                adversary={item}
                actions={
                  <>
                    <button
                      className="btn-outline px-2.5 py-1.5 text-xs"
                      type="button"
                      onClick={() => togglePinned(item.id)}
                    >
                      {expanded ? (pinned ? "Collapse" : "Previewing") : "Preview"}
                    </button>
                    <Link href={`/community/adversaries/${item.id}`} className="btn-outline px-2.5 py-1.5 text-xs">
                      Open Page
                    </Link>
                    <FavouriteToggle
                      adversaryId={item.id}
                      initialCount={item.favouriteCount ?? 0}
                      initialFavourited={Boolean(item.favourited)}
                      redirectTo={`/community/adversaries/${item.id}`}
                    />
                  </>
                }
              />

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <AdversaryStatBlock adversary={item} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hasMore && <div ref={loadMoreRef} className="mt-2 h-1 w-full" aria-hidden="true" />}

      {loading && <p className="mt-4 text-sm text-slate-300">Loading community adversaries...</p>}
      {!loading && !items.length && <p className="mt-4 text-sm text-slate-300">No matches found.</p>}

      {hasMore && (
        <div className="mt-4">
          <button className="btn-outline px-4 py-2 text-sm" disabled={loading} onClick={loadMore}>
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
