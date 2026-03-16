"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

export function ExportMenu({ characterId }: { characterId: number }) {
  const { push } = useToast();
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function createShare() {
    setCreatingShare(true);
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
    const data = await response.json();
    setCreatingShare(false);

    if (!response.ok) {
      push(data.error ?? "Failed to generate share link", "error");
      return;
    }

    setShareUrl(data.shareUrl ?? null);
    push("Share link generated", "success");
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    push("Share link copied", "success");
  }

  return (
    <section className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
      <h3 className="mb-2 text-sm text-amber-200">Export & Sharing</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <a
          href={`/api/characters/${characterId}/export/pdf`}
          className="btn-outline min-h-11 px-3 py-2 text-center text-xs"
        >
          Export PDF
        </a>
        <a
          href={`/api/characters/${characterId}/export/json`}
          className="btn-outline min-h-11 px-3 py-2 text-center text-xs"
        >
          Export JSON
        </a>
        <button
          className="btn-primary min-h-11 px-3 py-2 text-xs"
          disabled={creatingShare}
          onClick={createShare}
          type="button"
        >
          {creatingShare ? "Generating..." : "Create Share Link"}
        </button>
      </div>

      {shareUrl && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="field min-w-[200px] flex-1 text-xs" readOnly value={shareUrl} />
          <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={copyShare} type="button">
            Copy
          </button>
        </div>
      )}
    </section>
  );
}
