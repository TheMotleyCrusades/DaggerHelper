"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type ProductRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  teaser: string;
  access: "free" | "paid";
  visibility: "draft" | "listed" | "delisted";
};

type ProductVersion = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  isPublished: boolean;
};

type ProductDocument = {
  id: string;
  slug: string;
  title: string;
  visibility: "public_teaser" | "entitled_full";
  teaserMarkdown: string;
  bodyMarkdown: string;
};

function parseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { error?: unknown };
  if (typeof body.error === "string") return body.error;
  return fallback;
}

export function CommunityProductDetail({ productId }: { productId: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [documents, setDocuments] = useState<ProductDocument[]>([]);

  const [reason, setReason] = useState("Policy concern");
  const [details, setDetails] = useState("");
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const loadDocs = useCallback(async (versionId: string) => {
    const response = await fetch(`/api/products/${productId}/versions/${versionId}/documents`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(parseError(payload, "Failed to load documents."));
    }
    setDocuments(payload as ProductDocument[]);
  }, [productId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const [productResponse, versionsResponse] = await Promise.all([
          fetch(`/api/products/${productId}`, { cache: "no-store" }),
          fetch(`/api/products/${productId}/versions`, { cache: "no-store" }),
        ]);

        const productPayload = await productResponse.json();
        if (!productResponse.ok) {
          throw new Error(parseError(productPayload, "Failed to load product."));
        }

        const versionsPayload = await versionsResponse.json();
        if (!versionsResponse.ok) {
          throw new Error(parseError(versionsPayload, "Failed to load versions."));
        }

        if (cancelled) return;

        const loadedVersions = (versionsPayload as ProductVersion[]).sort(
          (left, right) => right.versionNumber - left.versionNumber
        );

        setProduct(productPayload as ProductRecord);
        setVersions(loadedVersions);

        const nextVersionId = loadedVersions[0]?.id ?? "";
        setSelectedVersionId(nextVersionId);

        if (nextVersionId) {
          await loadDocs(nextVersionId);
        } else {
          setDocuments([]);
        }

        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load product detail.");
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
  }, [loadDocs, productId]);

  useEffect(() => {
    if (!selectedVersionId) return;

    let cancelled = false;

    async function run() {
      try {
        await loadDocs(selectedVersionId);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load documents.");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadDocs, selectedVersionId]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setReportStatus(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          reason,
          details,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to submit report."));
      }

      setDetails("");
      setReportStatus("Report submitted.");
    } catch (reportError) {
      setReportStatus(reportError instanceof Error ? reportError.message : "Failed to submit report.");
    } finally {
      setSaving(false);
    }
  }

  const docSections = useMemo(() => {
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      visibility: doc.visibility,
      content:
        doc.visibility === "public_teaser" && doc.teaserMarkdown
          ? doc.teaserMarkdown
          : doc.bodyMarkdown || doc.teaserMarkdown || "",
    }));
  }, [documents]);

  return (
    <section className="space-y-4">
      <Link href="/community" className="btn-outline inline-flex min-h-11 items-center px-3 py-2 text-xs">
        Back to Community
      </Link>

      {loading && <p className="text-sm text-slate-300">Loading product detail...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && product && (
        <>
          <header className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
            <h1 className="text-2xl text-amber-300">{product.title}</h1>
            <p className="text-xs text-slate-500">/{product.slug}</p>
            {product.summary && <p className="mt-2 text-sm text-slate-300">{product.summary}</p>}
            {product.teaser && <p className="mt-2 text-sm text-slate-300">{product.teaser}</p>}
            <div className="mt-2 flex gap-2 text-xs text-slate-400">
              <span>Access: {product.access}</span>
              <span>Visibility: {product.visibility}</span>
            </div>
          </header>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
            <h2 className="text-lg text-amber-200">Version Documents</h2>
            <label className="mt-2 block text-xs text-slate-300">
              Version
              <select
                className="field mt-1"
                value={selectedVersionId}
                onChange={(event) => setSelectedVersionId(event.target.value)}
                disabled={!versions.length}
              >
                <option value="">Select version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.versionLabel || `v${version.versionNumber}`} {version.isPublished ? "(published)" : "(draft)"}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 space-y-3">
              {docSections.map((doc) => (
                <article key={doc.id} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
                  <p className="text-sm text-amber-100">{doc.title}</p>
                  <p className="text-xs text-slate-500">/{doc.slug} · {doc.visibility}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-200">{doc.content || "No content."}</pre>
                </article>
              ))}

              {!docSections.length && (
                <p className="text-sm text-slate-400">No visible documents for this version.</p>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
            <h2 className="text-lg text-amber-200">Report Content</h2>
            {!user && (
              <p className="text-xs text-slate-400">Sign in to submit a report for this product.</p>
            )}
            <form className="mt-2 grid gap-2" onSubmit={submitReport}>
              <label className="text-xs text-slate-300">
                Reason
                <select className="field mt-1" value={reason} onChange={(event) => setReason(event.target.value)}>
                  <option value="Policy concern">Policy concern</option>
                  <option value="Copyright concern">Copyright concern</option>
                  <option value="Mislabeled content">Mislabeled content</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Details
                <textarea
                  className="field mt-1 min-h-20"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Optional details"
                />
              </label>
              <button className="btn-primary min-h-11 px-3 py-2 text-sm" type="submit" disabled={!user || saving}>
                Submit Report
              </button>
            </form>
            {reportStatus && <p className="mt-2 text-xs text-slate-300">{reportStatus}</p>}
          </article>
        </>
      )}
    </section>
  );
}
