"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { WorldKindConfig } from "@/components/world/world-kinds";

type ContentEntry = {
  id: string;
  lineageKey: string;
  entityKind: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  updatedAt: string;
};

type DraftState = {
  name: string;
  description: string;
  tags: string;
};

const EMPTY_DRAFT: DraftState = {
  name: "",
  description: "",
  tags: "",
};

function parseError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const body = payload as {
    error?: unknown;
  };

  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object") {
    const maybeFlat = body.error as {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };

    if (Array.isArray(maybeFlat.formErrors) && maybeFlat.formErrors.length) {
      return maybeFlat.formErrors.join(", ");
    }

    const fieldEntries = Object.entries(maybeFlat.fieldErrors ?? {})
      .flatMap(([, values]) => values)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (fieldEntries.length) {
      return fieldEntries.join(", ");
    }
  }

  return fallback;
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString();
}

export function WorldKindManager({ config }: { config: WorldKindConfig }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [createDraft, setCreateDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const loaded = await loadEntries(config.entityKind);
        if (cancelled) return;
        setEntries(loaded);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load entries.");
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
  }, [config.entityKind]);

  async function loadEntries(entityKind: string) {
    const params = new URLSearchParams({ scope: "personal", kind: entityKind });
    const response = await fetch(`/api/content?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(parseError(payload, "Failed to load entries."));
    }

    return payload as ContentEntry[];
  }

  async function refresh() {
    setLoading(true);
    try {
      const loaded = await loadEntries(config.entityKind);
      setEntries(loaded);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load entries.");
    } finally {
      setLoading(false);
    }
  }

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createDraft.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityKind: config.entityKind,
          scope: "personal",
          name: createDraft.name.trim(),
          description: createDraft.description.trim(),
          tags: splitTags(createDraft.tags),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to create entry."));
      }

      setCreateDraft(EMPTY_DRAFT);
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create entry.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(entry: ContentEntry) {
    setEditingId(entry.id);
    setEditDraft({
      name: entry.name,
      description: entry.description,
      tags: entry.tags.join(", "),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    if (!editDraft.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/content/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim(),
          description: editDraft.description.trim(),
          tags: splitTags(editDraft.tags),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to update entry."));
      }

      cancelEdit();
      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update entry.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveEntry(entry: ContentEntry) {
    const confirmed = confirm(`Archive ${entry.name}?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/content/${entry.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to archive entry."));
      }

      if (editingId === entry.id) {
        cancelEdit();
      }
      await refresh();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive entry.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      return (
        entry.name.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.slug.toLowerCase().includes(query) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [entries, search]);

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
        <h2 className="text-2xl text-amber-300">{config.label} Creator</h2>
        <p className="text-sm text-slate-300">{config.description}</p>
      </header>

      <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
        <h3 className="text-lg text-amber-200">Create Personal Draft</h3>
        <p className="text-xs text-slate-400">
          Drafts are private by default and can be packaged into bundles from the World Creator Engine Bundles section.
        </p>
        <form className="mt-3 grid gap-3" onSubmit={createEntry}>
          <label className="text-xs text-slate-300">
            Name
            <input
              className="field mt-1"
              value={createDraft.name}
              onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-slate-300">
            Description
            <textarea
              className="field mt-1 min-h-24"
              value={createDraft.description}
              onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            Tags (comma separated)
            <input
              className="field mt-1"
              value={createDraft.tags}
              onChange={(event) => setCreateDraft((current) => ({ ...current, tags: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary min-h-11 px-3 py-2 text-sm" type="submit" disabled={saving}>
              Create Draft
            </button>
            <button
              className="btn-outline min-h-11 px-3 py-2 text-sm"
              type="button"
              onClick={() => setCreateDraft(EMPTY_DRAFT)}
              disabled={saving}
            >
              Reset
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg text-amber-200">My {config.label}</h3>
            <p className="text-xs text-slate-400">Archive entries you no longer want active in drafts.</p>
          </div>
          <label className="text-xs text-slate-300">
            Search
            <input
              className="field mt-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find by name, tag, or text"
            />
          </label>
        </div>

        {loading && <p className="text-sm text-slate-300">Loading entries...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !filtered.length && (
          <p className="text-sm text-slate-400">No entries yet for this kind.</p>
        )}

        <div className="space-y-3">
          {filtered.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-slate-700/45 bg-slate-950/55 p-3">
              {editingId === entry.id ? (
                <form className="grid gap-2" onSubmit={saveEdit}>
                  <label className="text-xs text-slate-300">
                    Name
                    <input
                      className="field mt-1"
                      value={editDraft.name}
                      onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Description
                    <textarea
                      className="field mt-1 min-h-20"
                      value={editDraft.description}
                      onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Tags
                    <input
                      className="field mt-1"
                      value={editDraft.tags}
                      onChange={(event) => setEditDraft((current) => ({ ...current, tags: event.target.value }))}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button className="btn-primary min-h-11 px-3 py-2 text-xs" type="submit" disabled={saving}>
                      Save
                    </button>
                    <button className="btn-outline min-h-11 px-3 py-2 text-xs" type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base text-amber-100">{entry.name}</p>
                      <p className="text-xs text-slate-500">slug: {entry.slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-outline min-h-11 px-3 py-2 text-xs"
                        type="button"
                        onClick={() => beginEdit(entry)}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
                        type="button"
                        onClick={() => void archiveEntry(entry)}
                        disabled={saving}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                  {entry.description && <p className="mt-2 text-sm text-slate-300">{entry.description}</p>}
                  <p className="mt-2 text-xs text-slate-500">Last updated: {formatTimestamp(entry.updatedAt)}</p>
                  {entry.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <span
                          key={`${entry.id}-${tag}`}
                          className="rounded border border-slate-600/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
