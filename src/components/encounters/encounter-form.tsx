"use client";

import { FormEvent, useState } from "react";
import {
  EncounterBuilder,
  type EncounterSelection,
} from "@/components/encounters/encounter-builder";

export type EncounterFormValue = {
  campaignId: number;
  name: string;
  description?: string;
  partySize: number;
  difficultyAdjustment: number;
  adversaries: EncounterSelection[];
};

export function EncounterForm({
  campaignOptions,
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  campaignOptions: Array<{ id: number; name: string }>;
  initial?: Partial<EncounterFormValue>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (value: EncounterFormValue) => Promise<void> | void;
}) {
  const [campaignId, setCampaignId] = useState<number>(initial?.campaignId ?? campaignOptions[0]?.id ?? 0);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [partySize, setPartySize] = useState(initial?.partySize ?? 4);
  const [difficultyAdjustment, setDifficultyAdjustment] = useState(initial?.difficultyAdjustment ?? 0);
  const [adversaries, setAdversaries] = useState<EncounterSelection[]>(initial?.adversaries ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit({
        campaignId,
        name: name.trim(),
        description: description.trim() || undefined,
        partySize,
        difficultyAdjustment,
        adversaries,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save encounter");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Campaign
          <select
            className="field mt-1"
            required
            value={campaignId || ""}
            onChange={(event) => setCampaignId(Number(event.target.value))}
          >
            {campaignOptions.length === 0 && <option value="">No campaigns available</option>}
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Encounter Name
          <input
            className="field mt-1"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ambush at the Broken Bridge"
          />
        </label>
      </div>

      <label className="text-sm text-slate-300">
        Description
        <textarea
          className="field mt-1 min-h-20"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Party Size
          <input
            className="field mt-1"
            type="number"
            min={1}
            max={10}
            value={partySize}
            onChange={(event) => setPartySize(Number(event.target.value))}
          />
        </label>

        <label className="text-sm text-slate-300">
          Difficulty Adjustment
          <input
            className="field mt-1"
            type="number"
            min={-5}
            max={10}
            value={difficultyAdjustment}
            onChange={(event) => setDifficultyAdjustment(Number(event.target.value))}
          />
        </label>
      </div>

      <EncounterBuilder
        partySize={partySize}
        difficultyAdjustment={difficultyAdjustment}
        selections={adversaries}
        onChange={setAdversaries}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary px-4 py-2 text-sm" disabled={loading || !campaignId}>
        {loading ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
