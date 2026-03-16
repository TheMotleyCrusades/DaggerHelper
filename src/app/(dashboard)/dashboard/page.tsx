"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardSummary = {
  counts: {
    campaignsOwned: number;
    campaignsJoined: number;
    characters: number;
    encounters: number;
    adversaries: number;
    publicAdversaries: number;
    personalContentTotals: {
      weapons: number;
      armor: number;
      items: number;
      consumables: number;
      total: number;
    };
  };
  ownedProducts: {
    total: number;
    free: number;
    paid: number;
  };
  creatorScore: {
    value: number;
  };
  resumeWork: Array<{
    kind: "campaign" | "character" | "encounter" | "adversary";
    id: number;
    title: string;
    href: string;
    updatedAt: string;
  }>;
  recentCommunityInteraction: {
    myFavouritesCount: number;
    topLiked: Array<{
      id: number;
      name: string;
      tier: number;
      type: string;
      likeCount: number;
      creatorName: string;
    }>;
    topContributors: Array<{
      userId: number;
      name: string;
      contributionCount: number;
      totalLikes: number;
    }>;
  };
};

function formatTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown";
  return new Date(timestamp).toLocaleString();
}

function kindLabel(kind: DashboardSummary["resumeWork"][number]["kind"]) {
  if (kind === "adversary") return "Adversary";
  if (kind === "campaign") return "Campaign";
  if (kind === "encounter") return "Encounter";
  return "Character";
}

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load dashboard summary.");
        setLoading(false);
        return;
      }

      setSummary(data as DashboardSummary);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-amber-700/35 bg-amber-950/20 p-4">
        <h2 className="text-2xl text-amber-300">Overview</h2>
        <p className="text-sm text-slate-300">
          Resume active work, monitor creator impact, and jump into campaigns fast.
        </p>
      </header>

      {loading && <p className="text-sm text-slate-300">Loading dashboard summary...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {summary && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Creator Score</p>
              <p className="text-2xl text-amber-200">{summary.creatorScore.value}</p>
              <p className="text-xs text-slate-300">Formula v1 active, commerce metrics arrive in later phases.</p>
            </article>
            <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Owned Products</p>
              <p className="text-2xl text-amber-200">{summary.ownedProducts.total}</p>
              <p className="text-xs text-slate-300">
                Free: {summary.ownedProducts.free} | Paid: {summary.ownedProducts.paid}
              </p>
            </article>
            <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Campaigns</p>
              <p className="text-2xl text-amber-200">{summary.counts.campaignsOwned + summary.counts.campaignsJoined}</p>
              <p className="text-xs text-slate-300">
                Owned: {summary.counts.campaignsOwned} | Joined: {summary.counts.campaignsJoined}
              </p>
            </article>
            <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Tracked Content</p>
              <p className="text-2xl text-amber-200">
                {summary.counts.adversaries + summary.counts.personalContentTotals.total}
              </p>
              <p className="text-xs text-slate-300">
                Adversaries: {summary.counts.adversaries} | Personal Library: {summary.counts.personalContentTotals.total}
              </p>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-lg text-amber-200">Resume Work</h3>
                <span className="text-xs text-slate-400">Most recently updated entries</span>
              </div>
              {summary.resumeWork.length ? (
                <div className="space-y-2">
                  {summary.resumeWork.map((item) => (
                    <Link
                      key={`${item.kind}-${item.id}`}
                      href={item.href}
                      className="block rounded-md border border-slate-700/55 bg-slate-950/45 px-3 py-2 text-sm hover:border-amber-500/45"
                    >
                      <p className="text-slate-100">
                        {kindLabel(item.kind)}: {item.title}
                      </p>
                      <p className="text-xs text-slate-400">Updated: {formatTimestamp(item.updatedAt)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-300">No recent work yet. Start with a campaign or adversary.</p>
              )}
            </article>

            <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
              <h3 className="mb-2 text-lg text-amber-200">Created Content Totals</h3>
              <div className="space-y-1 text-sm text-slate-300">
                <p>Characters: {summary.counts.characters}</p>
                <p>Encounters: {summary.counts.encounters}</p>
                <p>Adversaries: {summary.counts.adversaries}</p>
                <p>Public Adversaries: {summary.counts.publicAdversaries}</p>
                <p>Personal Weapons: {summary.counts.personalContentTotals.weapons}</p>
                <p>Personal Armor: {summary.counts.personalContentTotals.armor}</p>
                <p>Personal Items: {summary.counts.personalContentTotals.items}</p>
                <p>Personal Consumables: {summary.counts.personalContentTotals.consumables}</p>
              </div>
            </article>
          </div>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-lg text-amber-200">Recent Community Interaction</h3>
              <span className="text-xs text-slate-400">
                Your favourites: {summary.recentCommunityInteraction.myFavouritesCount}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h4 className="text-sm text-amber-100">Top Liked Contributions</h4>
                {summary.recentCommunityInteraction.topLiked.length ? (
                  <ul className="mt-1 space-y-1 text-xs text-slate-300">
                    {summary.recentCommunityInteraction.topLiked.slice(0, 5).map((entry) => (
                      <li key={`liked-${entry.id}`}>
                        {entry.name} ({entry.likeCount} likes) by {entry.creatorName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No community likes recorded yet.</p>
                )}
              </div>
              <div>
                <h4 className="text-sm text-amber-100">Top Contributors</h4>
                {summary.recentCommunityInteraction.topContributors.length ? (
                  <ul className="mt-1 space-y-1 text-xs text-slate-300">
                    {summary.recentCommunityInteraction.topContributors.slice(0, 5).map((entry) => (
                      <li key={`contributor-${entry.userId}`}>
                        {entry.name}: {entry.contributionCount} posts, {entry.totalLikes} likes
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No contributor data yet.</p>
                )}
              </div>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
