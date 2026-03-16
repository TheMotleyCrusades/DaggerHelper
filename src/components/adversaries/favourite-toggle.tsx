"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  adversaryId: number;
  initialCount: number;
  initialFavourited?: boolean;
  redirectTo?: string;
};

export function FavouriteToggle({
  adversaryId,
  initialCount,
  initialFavourited = false,
  redirectTo = "/community",
}: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [favourited, setFavourited] = useState(initialFavourited);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const response = await fetch(`/api/adversaries/${adversaryId}/favourite`, {
      method: "POST",
    });
    const data = await response.json();
    setPending(false);

    if (!response.ok) {
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(redirectTo)}`);
        return;
      }
      return;
    }

    setFavourited(Boolean(data.favourited));
    setCount(Number(data.count ?? 0));
    router.refresh();
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition ${
        favourited
          ? "border-amber-500/60 bg-amber-600/20 text-amber-200"
          : "border-slate-600 text-slate-300 hover:border-amber-500/50 hover:text-amber-200"
      }`}
      disabled={pending}
      onClick={toggle}
      title={favourited ? "Remove favourite" : "Add favourite"}
    >
      <Heart className={`h-3.5 w-3.5 ${favourited ? "fill-amber-300" : ""}`} />
      {count}
    </button>
  );
}
