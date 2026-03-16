"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdversaryForm, type AdversaryFormValue } from "@/components/adversaries/adversary-form";

type AdversaryResponse = AdversaryFormValue & {
  id: number;
};

export default function EditAdversaryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const invalidId = !Number.isFinite(id) || id <= 0;

  const [adversary, setAdversary] = useState<AdversaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) {
      return;
    }

    let cancelled = false;

    async function run() {
      const response = await fetch(`/api/adversaries/${id}`, { cache: "no-store" });
      const data = await response.json();

      if (cancelled) return;
      if (!response.ok) {
        setError(data.error ?? "Failed to load adversary");
        setLoading(false);
        return;
      }

      setAdversary(data);
      setError(null);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [id, invalidId]);

  async function updateAdversary(value: AdversaryFormValue) {
    const response = await fetch(`/api/adversaries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to update adversary");
    }
    router.push("/dashboard/adversaries");
    router.refresh();
  }

  async function deleteAdversary() {
    if (!confirm("Delete this adversary?")) return;
    const response = await fetch(`/api/adversaries/${id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/dashboard/adversaries");
      router.refresh();
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Edit Adversary</h2>
          <p className="text-sm text-slate-300">Update stats, visibility, and metadata.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/adversaries" className="btn-outline px-3 py-2 text-sm">
            Back
          </Link>
          <button
            className="rounded-md border border-red-400/45 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30"
            onClick={deleteAdversary}
          >
            Delete
          </button>
        </div>
      </div>

      {invalidId && <p className="text-red-400">Invalid adversary id.</p>}
      {loading && <p className="text-slate-300">Loading adversary...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {adversary && (
        <AdversaryForm
          initial={adversary}
          submitLabel="Save Changes"
          pendingLabel="Saving..."
          onSubmit={updateAdversary}
        />
      )}
    </section>
  );
}
