"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const characterPath = "/characters/create";
const loginForCharacterPath = `/login?next=${encodeURIComponent(characterPath)}`;
const registerForCharacterPath = `/register?next=${encodeURIComponent(characterPath)}`;

export function HomeHeroActions() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-wrap gap-3">
        <div className="h-12 w-44 rounded-xl border border-white/10 bg-slate-900/60" />
        <div className="h-12 w-44 rounded-xl border border-white/10 bg-slate-900/60" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-wrap gap-3">
        <Link href={characterPath} className="btn-primary px-5 py-3 text-sm">
          Start a Character
        </Link>
        <Link href="/community" className="btn-outline px-5 py-3 text-sm">
          Browse Community
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-transparent px-1 py-3 text-sm font-semibold text-amber-200 transition hover:text-amber-100"
        >
          Open Dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Link href={registerForCharacterPath} className="btn-primary px-5 py-3 text-sm">
        Start a Character
      </Link>
      <Link href="/community" className="btn-outline px-5 py-3 text-sm">
        Browse Community
      </Link>
      <Link
        href={loginForCharacterPath}
        className="inline-flex items-center gap-2 rounded-xl border border-transparent px-1 py-3 text-sm font-semibold text-amber-200 transition hover:text-amber-100"
      >
        Sign in
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
