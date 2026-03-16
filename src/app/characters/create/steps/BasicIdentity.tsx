"use client";

import { useMemo } from "react";
import { ClassSelectionStep } from "@/app/characters/create/steps/ClassSelection";
import type {
  HomebrewEntityRecord,
  HomebrewSubclassRecord,
} from "@/lib/homebrew-library";

type CampaignOption = {
  id: number;
  name: string;
};

type Props = {
  campaignId: number | null;
  campaignOptions: CampaignOption[];
  loadingCampaigns: boolean;
  campaignError: string | null;
  name: string;
  pronouns: string;
  level: number;
  className: string;
  subclass: string;
  allowedClassIds: string[];
  classOptions: HomebrewEntityRecord[];
  subclassOptions: HomebrewSubclassRecord[];
  loadingIdentityOptions: boolean;
  identityOptionsError: string | null;
  onSelectClass: (classId: string) => void;
  onSelectFoundation: (data: { class: string; subclass: string }) => void;
  onChange: (data: {
    campaignId?: number | null;
    name?: string;
    pronouns?: string;
    level?: number;
  }) => void;
};

const PRONOUN_OPTIONS = [
  "they/them",
  "she/her",
  "he/him",
  "she/they",
  "he/they",
  "ask first",
];

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function summarizeDescription(value: string, fallback: string) {
  const firstLine = value.split("\n")[0]?.trim();
  if (!firstLine) return fallback;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

function hashHue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

function classGradient(value: string) {
  const hue = hashHue(value || "class");
  const secondaryHue = (hue + 38) % 360;
  const tertiaryHue = (hue + 115) % 360;
  return `linear-gradient(140deg, hsla(${hue}, 72%, 46%, 0.3), hsla(${secondaryHue}, 68%, 34%, 0.22), hsla(${tertiaryHue}, 62%, 16%, 0.9))`;
}

export function BasicIdentityStep({
  campaignId,
  campaignOptions,
  loadingCampaigns,
  campaignError,
  name,
  pronouns,
  level,
  className,
  subclass,
  allowedClassIds,
  classOptions,
  subclassOptions,
  loadingIdentityOptions,
  identityOptionsError,
  onSelectClass,
  onSelectFoundation,
  onChange,
}: Props) {
  const classAllowlist = useMemo(
    () => new Set(allowedClassIds.map(normalizeToken)),
    [allowedClassIds]
  );

  const availableClasses = useMemo(() => {
    const filtered = classAllowlist.size
      ? classOptions.filter((item) => classAllowlist.has(normalizeToken(item.id)))
      : classOptions;
    return [...filtered].sort((left, right) => left.name.localeCompare(right.name));
  }, [classAllowlist, classOptions]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl text-amber-300">Step 1 - Identity & Class</h2>
        <p className="text-sm text-slate-300">
          Set campaign/name details, choose starting level, pick class, then lock foundation path.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300 sm:col-span-2">
          Campaign
          <select
            className="field mt-1"
            required
            value={campaignId ?? ""}
            onChange={(event) => onChange({ campaignId: Number(event.target.value) || null })}
          >
            <option value="">Select campaign</option>
            {campaignOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        {loadingCampaigns && <p className="text-xs text-slate-400 sm:col-span-2">Loading campaigns...</p>}
        {campaignError && <p className="text-xs text-red-400 sm:col-span-2">{campaignError}</p>}
        {loadingIdentityOptions && (
          <p className="text-xs text-slate-400 sm:col-span-2">Loading class options...</p>
        )}
        {identityOptionsError && (
          <p className="text-xs text-red-400 sm:col-span-2">{identityOptionsError}</p>
        )}

        <label className="text-sm text-slate-300 sm:col-span-2">
          Character Name
          <input
            className="field mt-1"
            required
            value={name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Name"
          />
        </label>

        <label className="text-sm text-slate-300">
          Pronouns
          <select
            className="field mt-1"
            value={pronouns}
            onChange={(event) => onChange({ pronouns: event.target.value })}
          >
            <option value="">Select pronouns</option>
            {PRONOUN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Starting Level
          <input
            className="field mt-1"
            type="number"
            min={1}
            max={10}
            value={level}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              const next = Number.isFinite(parsed) ? Math.max(1, Math.min(10, Math.round(parsed))) : 1;
              onChange({ level: next });
            }}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Levels above 1 unlock the Level Up tab in this wizard.
          </p>
        </label>
      </div>

      <article className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg text-amber-200">Class</h3>
          <p className="text-xs text-slate-400">
            Choose class first. Ancestry/community cards come in Step 2.
          </p>
        </div>

        {availableClasses.length ? (
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3">
              {availableClasses.map((item) => {
                const selected = item.id === className;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectClass(item.id)}
                    className={`w-72 shrink-0 overflow-hidden rounded-xl border text-left transition ${
                      selected
                        ? "border-amber-500/80 bg-amber-950/35"
                        : "border-slate-700/50 bg-slate-900/70 hover:border-amber-500/45"
                    }`}
                  >
                    <div
                      className="space-y-1 border-b border-slate-700/50 px-3 py-3"
                      style={{
                        backgroundImage: classGradient(item.id),
                      }}
                    >
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-200/75">
                        Class
                      </p>
                      <p className="text-xl text-amber-100">{item.name}</p>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-3 text-xs text-slate-300">
                        {summarizeDescription(item.description, "Class details unavailable.")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No classes are currently available in this campaign.</p>
        )}
      </article>

      <ClassSelectionStep
        className={className}
        subclass={subclass}
        allowedClassIds={allowedClassIds}
        classOptions={classOptions}
        subclassOptions={subclassOptions}
        loadingIdentityOptions={loadingIdentityOptions}
        identityOptionsError={identityOptionsError}
        showHeader={false}
        showStatus={false}
        onChange={onSelectFoundation}
      />
    </section>
  );
}
