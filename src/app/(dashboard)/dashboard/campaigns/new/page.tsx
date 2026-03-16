"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CampaignForm,
  type CampaignFormValue,
} from "@/components/campaigns/campaign-form";

export default function NewCampaignPage() {
  const router = useRouter();

  async function createCampaign(value: CampaignFormValue) {
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to create campaign");
    }

    router.push(`/dashboard/campaigns/${data.id}`);
    router.refresh();
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Create Campaign</h2>
          <p className="text-sm text-slate-300">Start a campaign and invite players by code.</p>
        </div>
        <Link href="/dashboard/campaigns" className="btn-outline px-3 py-2 text-sm">
          Back
        </Link>
      </div>

      <CampaignForm submitLabel="Create Campaign" pendingLabel="Creating..." onSubmit={createCampaign} />
    </section>
  );
}
