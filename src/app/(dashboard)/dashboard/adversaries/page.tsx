"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdversaryCard } from "@/components/adversaries/adversary-card";

type Adversary = {
  id: number;
  name: string;
  tier: number;
  type: string;
  description?: string | null;
  isPublic?: boolean;
  tags?: string[];
};

export default function DashboardAdversariesPage() {
  const [items, setItems] = useState<Adversary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  async function fetchItems() {
    const response = await fetch("/api/adversaries", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load adversaries");
    }
    return data as Adversary[];
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await fetchItems();
        if (cancelled) return;
        setItems(data);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load adversaries");
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
  }, [reloadToken]);

  function refresh() {
    setLoading(true);
    setReloadToken((current) => current + 1);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this adversary?")) return;
    const response = await fetch(`/api/adversaries/${id}`, { method: "DELETE" });
    if (response.ok) {
      refresh();
    }
  }

  async function handleTogglePublic(item: Adversary) {
    const response = await fetch(`/api/adversaries/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !item.isPublic }),
    });
    if (response.ok) {
      refresh();
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl text-amber-300">My Adversaries</h2>
        <div className="flex gap-2">
          <Link href="/community" className="btn-outline px-3 py-2 text-sm">
            Community
          </Link>
          <Link href="/dashboard/adversaries/new" className="btn-primary px-3 py-2 text-sm">
            New Adversary
          </Link>
        </div>
      </div>

      {loading && <p className="text-slate-300">Loading adversaries...</p>}
      {error && <p className="text-red-400">{error}</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <AdversaryCard
            key={item.id}
            adversary={item}
            actions={
              <>
                <Link href={`/dashboard/adversaries/${item.id}`} className="btn-outline px-2.5 py-1.5 text-xs">
                  Edit
                </Link>
                <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => handleTogglePublic(item)}>
                  {item.isPublic ? "Make Private" : "Make Public"}
                </button>
                <button
                  className="rounded-md border border-red-400/45 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              </>
            }
          />
        ))}
      </div>

      {!loading && !items.length && (
        <p className="text-sm text-slate-300">No adversaries yet. Create your first one.</p>
      )}
    </section>
  );
}
