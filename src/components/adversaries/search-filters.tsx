"use client";

import { useEffect, useState } from "react";
import { ADVERSARY_TYPES } from "@/lib/adversaries";

export type CommunityFilters = {
  search: string;
  type: string;
  tier: string;
  tags: string;
  sort: "newest" | "oldest" | "name_asc" | "name_desc";
};

const DEFAULT_FILTERS: CommunityFilters = {
  search: "",
  type: "",
  tier: "",
  tags: "",
  sort: "newest",
};

export function SearchFilters({
  initialFilters = DEFAULT_FILTERS,
  onApply,
}: {
  initialFilters?: CommunityFilters;
  onApply: (filters: CommunityFilters) => void;
}) {
  const [filters, setFilters] = useState<CommunityFilters>(initialFilters);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onApply(filters);
    }, 220);
    return () => clearTimeout(timeout);
  }, [filters, onApply]);

  function clear() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="panel mb-4 rounded-lg p-3">
      <div className="grid gap-3 md:grid-cols-5">
        <input
          className="field md:col-span-2"
          placeholder="Search name or description"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />

        <select
          className="field"
          value={filters.type}
          onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
        >
          <option value="">All types</option>
          {ADVERSARY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          className="field"
          value={filters.tier}
          onChange={(event) => setFilters((current) => ({ ...current, tier: event.target.value }))}
        >
          <option value="">All tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
          <option value="4">Tier 4</option>
        </select>

        <select
          className="field"
          value={filters.sort}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              sort: event.target.value as CommunityFilters["sort"],
            }))
          }
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          className="field"
          placeholder="Tag contains (e.g. undead)"
          value={filters.tags}
          onChange={(event) => setFilters((current) => ({ ...current, tags: event.target.value }))}
        />
        <p className="flex items-center px-2 text-xs text-slate-400">Filters update automatically.</p>
        <button className="btn-outline px-4 py-2 text-sm" onClick={clear} type="button">
          Reset
        </button>
      </div>
    </div>
  );
}
