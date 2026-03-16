"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AdversaryStatBlock,
  type AdversaryStatBlockData,
} from "@/components/adversaries/adversary-stat-block";
import { useToast } from "@/components/ui/toast-provider";

type HudFieldDefinition = {
  id: string;
  label: string;
  format: "current_max" | "single" | "checkbox" | "text";
  min: number | null;
  max: number | null;
};

type HudFieldValue = { current: string | number | boolean | null; max: number | null };
type HudPlayer = {
  characterId: number;
  name: string;
  class: string;
  level: number;
  sheetUrl: string;
  trackedFields: Record<string, HudFieldValue>;
  activeConditions: string[];
  gmNotes: string | null;
};
type HudCondition = { id: string; name: string; description: string };
type HudAdversary = {
  id: string;
  displayName: string;
  hpCurrent: number | null;
  stressCurrent: number | null;
  visibility: "active" | "hidden" | "escaped" | "defeated";
  conditions: string[];
  gmNotes: string | null;
  adversary: (AdversaryStatBlockData & { id: number }) | null;
};
type HudSnapshot = {
  campaign: { id: number; name: string };
  settings: {
    pinnedPlayerFields: string[];
    allowPublicAdversarySearch: boolean;
  };
  liveEncounter: {
    sourceEncounterId: number | null;
    status: "idle" | "active" | "paused" | "complete";
    sceneNotes: string | null;
  };
  fieldDefinitions: HudFieldDefinition[];
  availableConditions: HudCondition[];
  players: HudPlayer[];
  adversaries: HudAdversary[];
  encounters: Array<{ id: number; name: string; difficulty: string | null }>;
};
type SearchResult = { id: number; name: string; tier: number; type: string; sourceLabel: string };

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function clamp(definition: HudFieldDefinition, value: number) {
  let next = Math.round(value);
  if (typeof definition.min === "number") next = Math.max(definition.min, next);
  if (typeof definition.max === "number") next = Math.min(definition.max, next);
  return next;
}

export default function CampaignHudPage() {
  const { push } = useToast();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const campaignId = parseId(params.id);

  const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hoveredAdversary, setHoveredAdversary] = useState<string | null>(null);
  const [pinnedAdversary, setPinnedAdversary] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<"idle" | "active" | "paused" | "complete">("idle");
  const [notesDraft, setNotesDraft] = useState("");
  const [encounterIdDraft, setEncounterIdDraft] = useState("");
  const [allowPublicDraft, setAllowPublicDraft] = useState(true);
  const [pinnedFieldsDraft, setPinnedFieldsDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const fieldsById = useMemo(() => {
    const map = new Map<string, HudFieldDefinition>();
    for (const field of snapshot?.fieldDefinitions ?? []) map.set(field.id, field);
    return map;
  }, [snapshot?.fieldDefinitions]);

  async function refresh(silent = false) {
    if (!campaignId) return;
    if (!silent) setLoading(true);
    const response = await fetch(`/api/campaigns/${campaignId}/hud`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to load HUD");
      setLoading(false);
      return;
    }
    setSnapshot(data);
    setError(null);
    if (!dirty) {
      setStatusDraft(data.liveEncounter.status);
      setNotesDraft(data.liveEncounter.sceneNotes ?? "");
      setEncounterIdDraft(data.liveEncounter.sourceEncounterId ? String(data.liveEncounter.sourceEncounterId) : "");
      setAllowPublicDraft(Boolean(data.settings.allowPublicAdversarySearch));
      setPinnedFieldsDraft(data.settings.pinnedPlayerFields ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!campaignId) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || busy) return;
      void refresh(true);
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, busy]);

  useEffect(() => {
    const encounterId = searchParams.get("encounterId");
    if (!encounterId) return;
    if (!encounterIdDraft) {
      setEncounterIdDraft(encounterId);
      setDirty(true);
    }
  }, [encounterIdDraft, searchParams]);

  useEffect(() => {
    if (!campaignId || !searchText.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(
        `/api/campaigns/${campaignId}/hud/search-adversaries?q=${encodeURIComponent(searchText)}&allowPublic=${allowPublicDraft ? "true" : "false"}`
      );
      const data = await response.json();
      if (!response.ok) {
        push(data.error ?? "Failed to search adversaries", "error");
        return;
      }
      setSearchResults(Array.isArray(data.items) ? data.items : []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [allowPublicDraft, campaignId, push, searchText]);

  async function runMutation(input: Promise<Response>, success?: string) {
    setBusy(true);
    const response = await input;
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      push(data.error ?? "Action failed", "error");
      return false;
    }
    setSnapshot(data);
    if (success) push(success, "success");
    return true;
  }

  if (!campaignId) return <main className="p-6 text-red-400">Invalid campaign id.</main>;

  const pinnedFields = (snapshot?.settings.pinnedPlayerFields ?? [])
    .map((id) => fieldsById.get(id))
    .filter((item): item is HudFieldDefinition => Boolean(item));

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-6 sm:px-8">
      <header className="panel mb-4 rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl text-amber-300">GM Campaign HUD</h1>
            <p className="text-sm text-slate-300">{snapshot?.campaign.name ?? "Campaign"} live play control center.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/campaigns/${campaignId}`} className="btn-outline px-3 py-2 text-sm">Back</Link>
            <Link href={`/campaigns/${campaignId}/settings`} className="btn-outline px-3 py-2 text-sm">Console</Link>
            <button
              className="btn-primary px-3 py-2 text-sm"
              type="button"
              disabled={!dirty || busy}
              onClick={() =>
                void (async () => {
                  const ok = await runMutation(
                    fetch(`/api/campaigns/${campaignId}/hud`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        settings: {
                          pinnedPlayerFields: pinnedFieldsDraft,
                          allowPublicAdversarySearch: allowPublicDraft,
                        },
                        liveEncounter: {
                          status: statusDraft,
                          sceneNotes: notesDraft,
                          sourceEncounterId: encounterIdDraft ? Number(encounterIdDraft) : null,
                        },
                      }),
                    }),
                    "HUD settings saved."
                  );
                  if (ok) setDirty(false);
                })()
              }
            >
              Save HUD
            </button>
          </div>
        </div>
      </header>

      {loading && <p className="text-sm text-slate-300">Loading campaign HUD...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && snapshot && (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_0.9fr]">
          <article className="panel rounded-lg p-3">
            <h2 className="mb-2 text-xl text-amber-200">Player Rail</h2>
            <div className="space-y-3">
              {snapshot.players.map((player) => (
                <section key={player.characterId} className="rounded-md border border-slate-700/60 bg-slate-950/50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg text-amber-100">{player.name}</h3>
                      <p className="text-xs text-slate-400">{player.class} | Level {player.level}</p>
                    </div>
                    <Link href={player.sheetUrl} className="btn-outline px-2 py-1 text-xs">Sheet</Link>
                  </div>
                  <div className="space-y-1.5">
                    {pinnedFields.map((field) => {
                      const value = player.trackedFields[field.id];
                      if (!value) return null;
                      if (field.format === "checkbox") {
                        return (
                          <button
                            key={`${player.characterId}-${field.id}`}
                            type="button"
                            className={`w-full rounded border px-2 py-1.5 text-left text-xs ${value.current ? "border-emerald-500/60 text-emerald-200" : "border-slate-700/70 text-slate-300"}`}
                            onClick={() =>
                              void runMutation(
                                fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ fieldId: field.id, current: !Boolean(value.current) }),
                                })
                              )
                            }
                          >
                            {field.label}: {value.current ? "On" : "Off"}
                          </button>
                        );
                      }
                      const numeric = typeof value.current === "number" ? value.current : 0;
                      return (
                        <div key={`${player.characterId}-${field.id}`} className="flex items-center justify-between rounded border border-slate-700/70 px-2 py-1.5 text-xs">
                          <span>{field.label}: {value.current}{field.format === "current_max" ? ` / ${value.max ?? "-"}` : ""}</span>
                          <div className="flex gap-1">
                            <button className="rounded bg-slate-800 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldId: field.id, delta: -1 }) }))}>-1</button>
                            <button className="rounded bg-slate-800 px-2 py-1" type="button" onClick={() => {
                              const next = window.prompt(`Set ${field.label}`, String(numeric));
                              if (next === null) return;
                              const parsed = Number(next.trim());
                              if (!Number.isFinite(parsed)) return;
                              void runMutation(fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldId: field.id, current: clamp(field, parsed) }) }));
                            }}>Set</button>
                            {field.format === "current_max" && typeof value.max === "number" && (
                              <button
                                className="rounded bg-slate-800 px-2 py-1"
                                type="button"
                                onClick={() =>
                                  void runMutation(
                                    fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ fieldId: field.id, current: value.max }),
                                    })
                                  )
                                }
                              >
                                Max
                              </button>
                            )}
                            <button className="rounded bg-slate-800 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldId: field.id, delta: 1 }) }))}>+1</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {snapshot.availableConditions.map((condition) => {
                      const active = player.activeConditions.includes(condition.id);
                      return (
                        <button
                          key={`${player.characterId}-${condition.id}`}
                          type="button"
                          title={condition.description}
                          className={`rounded-full border px-2 py-0.5 text-xs ${active ? "border-amber-500/70 bg-amber-700/25 text-amber-100" : "border-slate-700/70 text-slate-300"}`}
                          onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toggleConditionId: condition.id }) }))}
                        >
                          {condition.name}
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-2 block text-xs text-slate-400">
                    GM Notes
                    <textarea
                      key={`${player.characterId}:${player.gmNotes ?? ""}`}
                      className="field mt-1 min-h-16 text-xs"
                      defaultValue={player.gmNotes ?? ""}
                      placeholder="Private note for this player..."
                      onBlur={(event) => {
                        void runMutation(
                          fetch(`/api/campaigns/${campaignId}/hud/characters/${player.characterId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ gmNotes: event.target.value }),
                          })
                        );
                      }}
                    />
                  </label>
                </section>
              ))}
            </div>
          </article>

          <article className="panel rounded-lg p-3">
            <h2 className="mb-2 text-xl text-amber-200">Live Encounter Lane</h2>
            <div className="mb-3 rounded-md border border-slate-700/60 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-56 flex-1 text-xs text-slate-300">Import Encounter
                  <select className="field mt-1" value={encounterIdDraft} onChange={(event) => { setEncounterIdDraft(event.target.value); setDirty(true); }}>
                    <option value="">Select encounter</option>
                    {snapshot.encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.name}</option>)}
                  </select>
                </label>
                <button
                  className="btn-outline px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!encounterIdDraft || busy}
                  onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/import-encounter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encounterId: Number(encounterIdDraft), mode: "merge" }) }), "Encounter merged.")}
                >
                  Merge
                </button>
                <button
                  className="btn-primary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!encounterIdDraft || busy}
                  onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/import-encounter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encounterId: Number(encounterIdDraft), mode: "replace" }) }), "Encounter replaced.")}
                >
                  Replace
                </button>
              </div>
            </div>
            <div className="mb-3 rounded-md border border-slate-700/60 bg-slate-950/50 p-3">
              <input className="field text-sm" placeholder="Search adversaries..." value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              {!!searchResults.length && (
                <div className="mt-2 max-h-48 space-y-1 overflow-auto">
                  {searchResults.map((result) => (
                    <button key={result.id} className="w-full rounded border border-slate-700/50 px-2 py-1.5 text-left text-xs hover:border-amber-500/50" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adversaryId: result.id }) }), "Adversary added.")}>
                      {result.name} | Tier {result.tier} | {result.sourceLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {snapshot.adversaries.map((instance) => {
                const expanded = hoveredAdversary === instance.id || pinnedAdversary === instance.id;
                return (
                  <section key={instance.id} className="rounded-md border border-slate-700/60 bg-slate-950/50 p-3" onMouseEnter={() => setHoveredAdversary(instance.id)} onMouseLeave={() => setHoveredAdversary((current) => current === instance.id ? null : current)}>
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="text-lg text-amber-100">{instance.displayName}</h3>
                      <div className="flex gap-1">
                        <button className="btn-outline px-2 py-1 text-xs" type="button" onClick={() => setPinnedAdversary((current) => current === instance.id ? null : instance.id)}>{pinnedAdversary === instance.id ? "Unpin" : "Pin"}</button>
                        <button className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-300" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "DELETE" }), "Adversary removed.")}>Remove</button>
                      </div>
                    </div>
                    <p className="mb-2 text-xs text-slate-400">Visibility: {instance.visibility}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hpCurrent: Math.max(0, (instance.hpCurrent ?? 0) - 1) }) }))}>HP {instance.hpCurrent ?? "-"} (-1)</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hpCurrent: Math.max(0, (instance.hpCurrent ?? 0) + 1) }) }))}>HP +1</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stressCurrent: Math.max(0, (instance.stressCurrent ?? 0) - 1) }) }))}>Stress {instance.stressCurrent ?? "-"} (-1)</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stressCurrent: Math.max(0, (instance.stressCurrent ?? 0) + 1) }) }))}>Stress +1</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: "defeated" }) }))}>Defeat</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: "active" }) }))}>Active</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: "hidden" }) }))}>Hidden</button>
                      <button className="rounded border border-slate-700/70 px-2 py-1" type="button" onClick={() => void runMutation(fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: "escaped" }) }))}>Escaped</button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {snapshot.availableConditions.map((condition) => {
                        const active = instance.conditions.includes(condition.id);
                        return (
                          <button
                            key={`${instance.id}-${condition.id}`}
                            type="button"
                            title={condition.description}
                            className={`rounded-full border px-2 py-0.5 text-xs ${active ? "border-amber-500/70 bg-amber-700/25 text-amber-100" : "border-slate-700/70 text-slate-300"}`}
                            onClick={() =>
                              void runMutation(
                                fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ toggleConditionId: condition.id }),
                                })
                              )
                            }
                          >
                            {condition.name}
                          </button>
                        );
                      })}
                    </div>
                    <label className="mt-2 block text-xs text-slate-400">
                      GM Notes
                      <textarea
                        key={`${instance.id}:${instance.gmNotes ?? ""}`}
                        className="field mt-1 min-h-14 text-xs"
                        defaultValue={instance.gmNotes ?? ""}
                        placeholder="Private note for this adversary..."
                        onBlur={(event) => {
                          void runMutation(
                            fetch(`/api/campaigns/${campaignId}/hud/adversaries/${instance.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ gmNotes: event.target.value }),
                            })
                          );
                        }}
                      />
                    </label>
                    <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ${expanded ? "mt-3 max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}>
                      {instance.adversary && <AdversaryStatBlock adversary={instance.adversary} />}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>

          <article className="panel rounded-lg p-3">
            <h2 className="mb-2 text-xl text-amber-200">Inspector & Utilities</h2>
            <div className="space-y-3">
              <label className="text-xs text-slate-300">Session Status
                <select className="field mt-1" value={statusDraft} onChange={(event) => { setStatusDraft(event.target.value as typeof statusDraft); setDirty(true); }}>
                  <option value="idle">Idle</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="complete">Complete</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={allowPublicDraft} onChange={(event) => { setAllowPublicDraft(event.target.checked); setDirty(true); }} />
                Allow public adversary search
              </label>
              <div>
                <p className="mb-1 text-xs text-slate-300">Pinned Player Fields</p>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.fieldDefinitions.map((field) => {
                    const active = pinnedFieldsDraft.includes(field.id);
                    return (
                      <button key={field.id} type="button" className={`rounded-full border px-2 py-0.5 text-xs ${active ? "border-amber-500/70 bg-amber-700/25 text-amber-100" : "border-slate-700/70 text-slate-300"}`} onClick={() => { setPinnedFieldsDraft((current) => current.includes(field.id) ? current.filter((id) => id !== field.id) : [...current, field.id]); setDirty(true); }}>
                        {field.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="text-xs text-slate-300">Scene Notes
                <textarea className="field mt-1 min-h-40" value={notesDraft} onChange={(event) => { setNotesDraft(event.target.value); setDirty(true); }} />
              </label>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
