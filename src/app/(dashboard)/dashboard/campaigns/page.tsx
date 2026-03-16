"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Campaign = {
  id: number;
  name: string;
  description?: string | null;
  inviteCode?: string | null;
  isOwner: boolean;
  memberRole: string;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState(
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("join") ?? ""
  );
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const data = await response.json();

      if (cancelled) return;
      if (!response.ok) {
        setError(data.error ?? "Failed to load campaigns");
        setLoading(false);
        return;
      }

      setCampaigns(Array.isArray(data) ? data : []);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function joinCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoining(true);

    const response = await fetch("/api/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: joinCode }),
    });
    const data = await response.json();
    setJoining(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to join campaign");
      return;
    }

    const refreshed = await fetch("/api/campaigns", { cache: "no-store" });
    const refreshedData = await refreshed.json();
    if (refreshed.ok) {
      setCampaigns(Array.isArray(refreshedData) ? refreshedData : []);
      setJoinCode("");
      setError(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl text-amber-300">Campaigns</h2>
          <p className="text-sm text-slate-300">Create campaigns, share invite codes, and manage party members.</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn-primary px-3 py-2 text-sm">
          New Campaign
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" onSubmit={joinCampaign}>
        <input
          className="field min-w-[220px] flex-1"
          placeholder="Join with invite code"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
        />
        <button className="btn-outline px-3 py-2 text-sm" disabled={joining || !joinCode.trim()}>
          {joining ? "Joining..." : "Join Campaign"}
        </button>
      </form>

      {loading && <p className="text-sm text-slate-300">Loading campaigns...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg text-amber-200">{campaign.name}</h3>
                <p className="text-xs text-slate-300">
                  {campaign.isOwner ? "GM" : "Member"} | Role: {campaign.memberRole}
                </p>
                {campaign.description && <p className="mt-1 text-sm text-slate-300">{campaign.description}</p>}
              </div>
              <Link href={`/dashboard/campaigns/${campaign.id}`} className="btn-outline px-3 py-1.5 text-xs">
                Open
              </Link>
            </div>
          </article>
        ))}
      </div>

      {!loading && !campaigns.length && (
        <p className="text-sm text-slate-300">No campaigns yet. Start by creating one.</p>
      )}
    </section>
  );
}
