"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Encounter = {
  id: number;
  campaignId: number;
  name: string;
  description?: string | null;
  difficulty?: string | null;
  adversaryCount?: number;
};

type Campaign = { id: number; name: string };

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [encounterResponse, campaignResponse] = await Promise.all([
        fetch(campaignFilter ? `/api/encounters?campaignId=${campaignFilter}` : "/api/encounters", {
          cache: "no-store",
        }),
        fetch("/api/campaigns", { cache: "no-store" }),
      ]);

      const encounterData = await encounterResponse.json();
      const campaignData = await campaignResponse.json();

      if (cancelled) return;
      if (!encounterResponse.ok) {
        setError(encounterData.error ?? "Failed to load encounters");
        setLoading(false);
        return;
      }

      setEncounters(Array.isArray(encounterData) ? encounterData : []);
      setCampaigns(Array.isArray(campaignData) ? campaignData : []);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignFilter]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl text-amber-300">Encounters</h2>
          <p className="text-sm text-slate-300">Build balanced encounters using battle-point budgets.</p>
        </div>
        <Link href="/dashboard/encounters/new" className="btn-primary px-3 py-2 text-sm">
          New Encounter
        </Link>
      </div>

      <div className="mb-4 max-w-sm">
        <label className="text-sm text-slate-300">
          Filter by Campaign
          <select
            className="field mt-1"
            value={campaignFilter}
            onChange={(event) => {
              setLoading(true);
              setCampaignFilter(event.target.value);
            }}
          >
            <option value="">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading encounters...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-3">
        {encounters.map((encounter) => (
          <article key={encounter.id} className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg text-amber-200">{encounter.name}</h3>
                <p className="text-xs text-slate-300">
                  Campaign #{encounter.campaignId} | {encounter.difficulty ?? "unknown"} | {encounter.adversaryCount ?? 0} foes
                </p>
                {encounter.description && <p className="mt-1 text-sm text-slate-300">{encounter.description}</p>}
              </div>
              <Link href={`/dashboard/encounters/${encounter.id}`} className="btn-outline px-3 py-1.5 text-xs">
                Open
              </Link>
            </div>
          </article>
        ))}
      </div>

      {!loading && !encounters.length && (
        <p className="text-sm text-slate-300">No encounters yet. Build your first one.</p>
      )}
    </section>
  );
}
