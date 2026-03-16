"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CampaignForm,
  type CampaignFormValue,
} from "@/components/campaigns/campaign-form";
import { CampaignMembers } from "@/components/campaigns/campaign-members";

type Campaign = {
  id: number;
  name: string;
  description?: string | null;
  inviteCode?: string | null;
  isOwner: boolean;
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return;
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/campaigns/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load campaign");
        setLoading(false);
        return;
      }

      setCampaign(data);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function updateCampaign(value: CampaignFormValue) {
    const response = await fetch(`/api/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to update campaign");
    }
    setCampaign((current) =>
      current
        ? {
            ...current,
            name: data.name,
            description: data.description,
          }
        : current
    );
  }

  async function deleteCampaign() {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/dashboard/campaigns");
      router.refresh();
    }
  }

  if (!Number.isInteger(id) || id <= 0) {
    return <p className="text-red-400">Invalid campaign id.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Campaign Details</h2>
          <p className="text-sm text-slate-300">Manage campaign details, invite links, and members.</p>
        </div>
        <div className="flex gap-2">
          {campaign?.isOwner && (
            <button
              className="rounded-md border border-red-400/45 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30"
              onClick={deleteCampaign}
              type="button"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading campaign...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {campaign && (
        <>
          <article className="panel rounded-lg p-4">
            {campaign.isOwner ? (
              <CampaignForm
                initial={{ name: campaign.name, description: campaign.description ?? undefined }}
                submitLabel="Save Campaign"
                pendingLabel="Saving..."
                onSubmit={updateCampaign}
              />
            ) : (
              <div className="space-y-2">
                <h3 className="text-lg text-amber-200">{campaign.name}</h3>
                {campaign.description && <p className="text-sm text-slate-300">{campaign.description}</p>}
                <p className="text-xs text-slate-400">
                  You are a member of this campaign. Only the GM can edit campaign settings.
                </p>
              </div>
            )}
          </article>

          <article className="panel rounded-lg p-4">
            <CampaignMembers
              campaignId={campaign.id}
              inviteCode={campaign.inviteCode ?? null}
              canManage={campaign.isOwner}
            />
          </article>

          <article className="panel rounded-lg p-4">
            <h3 className="mb-2 text-lg text-amber-200">Next Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/encounters/new?campaignId=${campaign.id}`} className="btn-primary px-3 py-2 text-sm">
                Build Encounter
              </Link>
              <Link href={`/dashboard/campaigns/${campaign.id}/content`} className="btn-outline px-3 py-2 text-sm">
                Campaign Content Manager
              </Link>
              {campaign.isOwner && (
                <Link href={`/campaigns/${campaign.id}/settings`} className="btn-outline px-3 py-2 text-sm">
                  GM Customization Console
                </Link>
              )}
              {campaign.isOwner && (
                <Link href={`/campaigns/${campaign.id}/hud`} className="btn-outline px-3 py-2 text-sm">
                  Launch GM HUD
                </Link>
              )}
              <Link href="/dashboard/adversaries" className="btn-outline px-3 py-2 text-sm">
                Manage Adversaries
              </Link>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
