"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdversaryWizard } from "@/components/adversaries/adversary-wizard";
import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";

export default function NewAdversaryPage() {
  const router = useRouter();

  async function createAdversary(value: AdversaryFormValue) {
    const response = await fetch("/api/adversaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to create adversary");
    }

    router.push(`/dashboard/adversaries/${data.id}`);
    router.refresh();
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Create Adversary</h2>
          <p className="text-sm text-slate-300">Build a custom stat block for your campaigns.</p>
        </div>
        <Link href="/dashboard/adversaries" className="btn-outline px-3 py-2 text-sm">
          Back
        </Link>
      </div>

      <AdversaryWizard onSubmit={createAdversary} />
    </section>
  );
}
