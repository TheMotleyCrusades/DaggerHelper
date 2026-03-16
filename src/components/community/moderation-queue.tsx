"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type ReportStatus = "open" | "resolved" | "dismissed";
type ModerationAction = "dismiss" | "warn" | "delist" | "restrict";

type ReportRecord = {
  id: string;
  productId: string | null;
  entityKind: string | null;
  entityId: string | null;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
};

function parseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { error?: unknown };
  if (typeof body.error === "string") return body.error;
  return fallback;
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString();
}

function shortId(value: string | null) {
  if (!value) return "n/a";
  return value.slice(0, 8);
}

function isModerator(role: string | null | undefined) {
  return role === "moderator" || role === "admin";
}

export function ModerationQueue() {
  const { appUser, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("open");
  const [reports, setReports] = useState<ReportRecord[]>([]);

  useEffect(() => {
    if (!isModerator(appUser?.role)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);

        const response = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(parseError(payload, "Failed to load reports."));
        }

        if (cancelled) return;
        setReports(payload as ReportRecord[]);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load reports.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [appUser?.role, statusFilter]);

  async function moderate(report: ReportRecord, status: "resolved" | "dismissed", action: ModerationAction) {
    setSaving(true);
    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to apply moderation action."));
      }

      setReports((current) =>
        current.map((item) => (item.id === report.id ? { ...item, status } : item))
      );
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Failed to apply moderation action."
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <p className="text-sm text-slate-300">Checking access...</p>;
  }

  if (!isModerator(appUser?.role)) {
    return <p className="text-sm text-slate-400">Moderator role required for this queue.</p>;
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl text-amber-200">Moderation Queue</h2>
          <p className="text-sm text-slate-300">Review user reports and apply actions to products/entities.</p>
        </div>
        <label className="text-xs text-slate-300">
          Status
          <select
            className="field mt-1"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | ReportStatus)}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
      </header>

      {loading && <p className="text-sm text-slate-300">Loading reports...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !reports.length && <p className="text-sm text-slate-400">No reports in this filter.</p>}

      <div className="space-y-2">
        {reports.map((report) => (
          <article key={report.id} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
            <p className="text-sm text-amber-100">{report.reason}</p>
            <p className="text-xs text-slate-500">status: {report.status}</p>
            <p className="text-xs text-slate-500">
              product: {shortId(report.productId)} · entity: {report.entityKind ?? "n/a"}/{shortId(report.entityId)}
            </p>
            <p className="text-xs text-slate-500">created: {formatTimestamp(report.createdAt)}</p>
            {report.details && <p className="mt-2 text-xs text-slate-300">{report.details}</p>}

            {report.status === "open" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="btn-primary min-h-11 px-3 py-2 text-xs"
                  onClick={() => void moderate(report, "resolved", "warn")}
                  type="button"
                  disabled={saving}
                >
                  Resolve + Warn
                </button>
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => void moderate(report, "resolved", "delist")}
                  type="button"
                  disabled={saving}
                >
                  Resolve + Delist
                </button>
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => void moderate(report, "dismissed", "dismiss")}
                  type="button"
                  disabled={saving}
                >
                  Dismiss
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
