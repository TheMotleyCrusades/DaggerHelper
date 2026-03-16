"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CampaignRecord = {
  id: number;
  name: string;
  isOwner: boolean;
};

type CatalogProduct = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  access: "free" | "paid";
  visibility: "draft" | "listed" | "delisted";
};

type ProductVersion = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  isPublished: boolean;
  createdAt: string;
};

type CampaignInstall = {
  id: string;
  campaignId: number;
  productId: string;
  productVersionId: string;
  installOrder: number;
  source: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

type CampaignSuggestion = {
  id: string;
  campaignId: number;
  suggestedByUserId: number;
  productId: string;
  productVersionId: string | null;
  note: string;
  status: "pending" | "approved" | "rejected";
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  createdAt: string;
};

type LineageCollision = {
  lineageKey: string;
  currentProductId: string;
  currentProductTitle: string;
  currentVersionId: string;
  incomingProductId: string;
  incomingProductTitle: string;
  incomingVersionId: string;
};

type InstallConflictResponse = {
  requiresConfirmation: true;
  collisions: LineageCollision[];
  error: string;
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

function shortUuid(value: string) {
  return value.slice(0, 8);
}

export function CampaignContentManager({ campaignId }: { campaignId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [installs, setInstalls] = useState<CampaignInstall[]>([]);
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [availableVersions, setAvailableVersions] = useState<ProductVersion[]>([]);
  const [suggestionNote, setSuggestionNote] = useState("");

  const [pendingCollision, setPendingCollision] = useState<{
    productId: string;
    productVersionId: string;
    collisions: LineageCollision[];
  } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignResponse, catalogResponse, installsResponse, suggestionsResponse] =
        await Promise.all([
          fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" }),
          fetch("/api/products?catalog=true", { cache: "no-store" }),
          fetch(`/api/campaign-content/${campaignId}/installs`, { cache: "no-store" }),
          fetch(`/api/campaign-content/${campaignId}/suggestions`, { cache: "no-store" }),
        ]);

      const campaignPayload = await campaignResponse.json();
      if (!campaignResponse.ok) {
        throw new Error(parseError(campaignPayload, "Failed to load campaign."));
      }

      const catalogPayload = await catalogResponse.json();
      if (!catalogResponse.ok) {
        throw new Error(parseError(catalogPayload, "Failed to load catalog products."));
      }

      const installsPayload = await installsResponse.json();
      if (!installsResponse.ok) {
        throw new Error(parseError(installsPayload, "Failed to load installs."));
      }

      const suggestionsPayload = await suggestionsResponse.json();
      if (!suggestionsResponse.ok) {
        throw new Error(parseError(suggestionsPayload, "Failed to load suggestions."));
      }

      setCampaign(campaignPayload as CampaignRecord);
      setCatalogProducts(catalogPayload as CatalogProduct[]);
      setInstalls(installsPayload as CampaignInstall[]);
      setSuggestions(suggestionsPayload as CampaignSuggestion[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load campaign content manager.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedProductId) {
      setAvailableVersions([]);
      setSelectedVersionId("");
      return;
    }

    let cancelled = false;

    async function loadVersions() {
      try {
        const response = await fetch(`/api/products/${selectedProductId}/versions`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(parseError(payload, "Failed to load product versions."));
        }

        if (cancelled) return;
        const versions = (payload as ProductVersion[]).sort(
          (left, right) => right.versionNumber - left.versionNumber
        );
        setAvailableVersions(versions);
        setSelectedVersionId((current) =>
          current && versions.some((version) => version.id === current)
            ? current
            : versions[0]?.id ?? ""
        );
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load versions.");
      }
    }

    void loadVersions();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  const productById = useMemo(() => {
    return new Map(catalogProducts.map((product) => [product.id, product]));
  }, [catalogProducts]);

  async function installProduct(confirmOverwrite: boolean) {
    if (!selectedProductId || !selectedVersionId) {
      setError("Select both a product and a version.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/campaign-content/${campaignId}/installs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          productVersionId: selectedVersionId,
          confirmOverwrite,
          source: "campaign-manager",
        }),
      });
      const payload = await response.json();

      if (response.status === 409) {
        const conflict = payload as InstallConflictResponse;
        if (conflict.requiresConfirmation && Array.isArray(conflict.collisions)) {
          setPendingCollision({
            productId: selectedProductId,
            productVersionId: selectedVersionId,
            collisions: conflict.collisions,
          });
          return;
        }
      }

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to install product."));
      }

      setPendingCollision(null);
      await loadAll();
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : "Failed to install product.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveInstall(install: CampaignInstall) {
    const confirmed = confirm(
      "Archive this install? Installed content may stop resolving in builders and sheets."
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/campaign-content/${campaignId}/installs/${install.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to archive install."));
      }

      await loadAll();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive install.");
    } finally {
      setSaving(false);
    }
  }

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProductId) {
      setError("Select a product first.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/campaign-content/${campaignId}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          productVersionId: selectedVersionId || null,
          note: suggestionNote.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to create suggestion."));
      }

      setSuggestionNote("");
      await loadAll();
    } catch (suggestionError) {
      setError(
        suggestionError instanceof Error ? suggestionError.message : "Failed to create suggestion."
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewSuggestion(
    suggestion: CampaignSuggestion,
    status: "approved" | "rejected"
  ) {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/campaign-content/${campaignId}/suggestions/${suggestion.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to review suggestion."));
      }

      await loadAll();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Failed to review suggestion.");
    } finally {
      setSaving(false);
    }
  }

  const sortedInstalls = useMemo(() => {
    return [...installs].sort((left, right) => right.installOrder - left.installOrder);
  }, [installs]);

  const pendingSuggestions = useMemo(() => {
    return suggestions.filter((item) => item.status === "pending");
  }, [suggestions]);

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
        <h2 className="text-2xl text-amber-300">Campaign Content Manager</h2>
        <p className="text-sm text-slate-300">
          Install product versions into this campaign, handle lineage overwrite warnings, and review member suggestions.
        </p>
        {campaign && (
          <p className="mt-1 text-xs text-slate-400">
            Campaign: {campaign.name} · role: {campaign.isOwner ? "owner" : "member"}
          </p>
        )}
      </header>

      {loading && <p className="text-sm text-slate-300">Loading campaign content...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && campaign && (
        <>
          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <h3 className="text-lg text-amber-200">Install Or Suggest Content</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-300">
                Product
                <select
                  className="field mt-1"
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  <option value="">Select product</option>
                  {catalogProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title} ({product.access})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Version
                <select
                  className="field mt-1"
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  disabled={!availableVersions.length}
                >
                  <option value="">Select version</option>
                  {availableVersions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.versionLabel || `v${version.versionNumber}`} {version.isPublished ? "(published)" : "(draft)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block text-xs text-slate-300">
              Suggestion Note
              <textarea
                className="field mt-1 min-h-20"
                value={suggestionNote}
                onChange={(event) => setSuggestionNote(event.target.value)}
                placeholder="Optional context for why this should be installed"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {campaign.isOwner ? (
                <button
                  className="btn-primary min-h-11 px-3 py-2 text-sm"
                  type="button"
                  onClick={() => void installProduct(false)}
                  disabled={!selectedProductId || !selectedVersionId || saving}
                >
                  Install Version
                </button>
              ) : (
                <form onSubmit={submitSuggestion}>
                  <button
                    className="btn-primary min-h-11 px-3 py-2 text-sm"
                    type="submit"
                    disabled={!selectedProductId || saving}
                  >
                    Suggest Install
                  </button>
                </form>
              )}
            </div>

            {pendingCollision && (
              <div className="mt-3 rounded-md border border-red-500/50 bg-red-950/30 p-3">
                <p className="text-sm text-red-200">
                  Installing this version will overwrite lineage winners. Confirm to continue.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-red-100">
                  {pendingCollision.collisions.map((collision) => (
                    <li key={`${collision.lineageKey}-${collision.currentProductId}`}>
                      lineage <strong>{collision.lineageKey}</strong>: {collision.currentProductTitle} ({shortUuid(collision.currentVersionId)})
                      {" -> "}
                      {collision.incomingProductTitle} ({shortUuid(collision.incomingVersionId)})
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <button
                    className="btn-primary min-h-11 px-3 py-2 text-xs"
                    type="button"
                    onClick={() => void installProduct(true)}
                    disabled={saving}
                  >
                    Confirm Overwrite
                  </button>
                  <button
                    className="btn-outline min-h-11 px-3 py-2 text-xs"
                    type="button"
                    onClick={() => setPendingCollision(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <h3 className="text-lg text-amber-200">Installed Versions</h3>
            <p className="text-xs text-slate-400">
              Latest install order wins per lineage key. Archiving an install may change active resolved content.
            </p>
            <div className="mt-3 space-y-2">
              {sortedInstalls.map((install) => {
                const product = productById.get(install.productId);
                return (
                  <article key={install.id} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-amber-100">{product?.title ?? `Product ${shortUuid(install.productId)}`}</p>
                        <p className="text-xs text-slate-500">
                          version: {shortUuid(install.productVersionId)} · order: {install.installOrder}
                        </p>
                        <p className="text-xs text-slate-500">
                          {install.isArchived ? "archived" : "active"} · updated {formatTimestamp(install.updatedAt)}
                        </p>
                      </div>
                      {campaign.isOwner && !install.isArchived && (
                        <button
                          className="rounded-md border border-red-400/45 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
                          type="button"
                          onClick={() => void archiveInstall(install)}
                          disabled={saving}
                        >
                          Archive Install
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {!sortedInstalls.length && (
                <p className="text-sm text-slate-400">No installs yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
            <h3 className="text-lg text-amber-200">Install Suggestions</h3>
            <p className="text-xs text-slate-400">Members can propose products. Owner can approve or reject pending suggestions.</p>

            <div className="mt-3 space-y-2">
              {suggestions.map((suggestion) => {
                const product = productById.get(suggestion.productId);
                return (
                  <article key={suggestion.id} className="rounded-md border border-slate-700/45 bg-slate-950/55 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-amber-100">{product?.title ?? `Product ${shortUuid(suggestion.productId)}`}</p>
                        <p className="text-xs text-slate-500">
                          version: {suggestion.productVersionId ? shortUuid(suggestion.productVersionId) : "latest requested"}
                        </p>
                        <p className="text-xs text-slate-500">status: {suggestion.status}</p>
                        <p className="text-xs text-slate-500">submitted: {formatTimestamp(suggestion.createdAt)}</p>
                        {suggestion.note && <p className="mt-1 text-xs text-slate-300">{suggestion.note}</p>}
                      </div>
                      {campaign.isOwner && suggestion.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            className="btn-primary min-h-11 px-3 py-2 text-xs"
                            type="button"
                            onClick={() => void reviewSuggestion(suggestion, "approved")}
                            disabled={saving}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-outline min-h-11 px-3 py-2 text-xs"
                            type="button"
                            onClick={() => void reviewSuggestion(suggestion, "rejected")}
                            disabled={saving}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {!suggestions.length && (
                <p className="text-sm text-slate-400">No suggestions yet.</p>
              )}
            </div>

            {campaign.isOwner && pendingSuggestions.length > 0 && (
              <p className="mt-2 text-xs text-amber-200">
                You have {pendingSuggestions.length} pending suggestion(s) to review.
              </p>
            )}
          </article>
        </>
      )}
    </section>
  );
}
