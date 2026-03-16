"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdversaryStatBlock } from "@/components/adversaries/adversary-stat-block";
import { FavouriteToggle } from "@/components/adversaries/favourite-toggle";
import { useAuth } from "@/components/auth/auth-provider";
import { HomeAuthCta } from "@/components/auth/home-auth-cta";

type PublicAdversary = {
  id: number;
  userId: number;
  name: string;
  tier: number;
  type: string;
  description?: string | null;
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
  tags?: string[] | null;
  potentialDicePools?: string[] | null;
  features?: Array<{ name: string; type: string; description: string }> | null;
  experiences?: Array<{ phrase: string; value?: string }> | null;
  favouriteCount: number;
  favourited: boolean;
  creator?: {
    id: number | null;
    name: string;
  };
};

export default function CommunityAdversaryPage() {
  const params = useParams<{ id: string }>();
  const { appUser } = useAuth();
  const id = Number(params.id);
  const invalidId = !Number.isInteger(id) || id <= 0;

  const [loading, setLoading] = useState(!invalidId);
  const [error, setError] = useState<string | null>(invalidId ? "Invalid adversary id." : null);
  const [adversary, setAdversary] = useState<PublicAdversary | null>(null);

  useEffect(() => {
    if (invalidId) return;

    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/adversaries/public/${id}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Adversary not found.");
        setLoading(false);
        return;
      }

      setAdversary(data as PublicAdversary);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, invalidId]);

  const canEdit = useMemo(() => {
    if (!adversary || !appUser) return false;
    return appUser.id === adversary.userId;
  }, [adversary, appUser]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl text-amber-300">Community Stat Block</h1>
            <p className="text-sm text-slate-300">
              {adversary?.creator?.name ? `Contributed by ${adversary.creator.name}` : "Public contribution"}
            </p>
          </div>
          <HomeAuthCta />
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href="/" className="btn-outline min-h-11 px-3 py-2 text-sm">
            Home
          </Link>
          <Link href="/characters" className="btn-outline min-h-11 px-3 py-2 text-sm">
            Characters
          </Link>
          <Link href="/community" className="btn-outline min-h-11 px-3 py-2 text-sm">
            Community
          </Link>
          {canEdit && (
            <Link href={`/dashboard/adversaries/${adversary?.id}`} className="btn-outline min-h-11 px-3 py-2 text-sm">
              Edit in Dashboard
            </Link>
          )}
        </nav>
      </header>

      {loading && <p className="text-sm text-slate-300">Loading adversary stat block...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {adversary && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FavouriteToggle
              adversaryId={adversary.id}
              initialCount={adversary.favouriteCount}
              initialFavourited={adversary.favourited}
              redirectTo={`/community/adversaries/${adversary.id}`}
            />
          </div>
          <AdversaryStatBlock adversary={adversary} />
        </section>
      )}
    </main>
  );
}
