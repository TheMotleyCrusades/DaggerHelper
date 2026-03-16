"use client";

import { FormEvent, useState } from "react";

export type CampaignFormValue = {
  name: string;
  description?: string;
};

export function CampaignForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  initial?: Partial<CampaignFormValue>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (value: CampaignFormValue) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="text-sm text-slate-300">
        Campaign Name
        <input
          className="field mt-1"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="The Shattered Crown"
        />
      </label>

      <label className="text-sm text-slate-300">
        Description
        <textarea
          className="field mt-1 min-h-24"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Campaign notes, tone, themes..."
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button className="btn-primary px-4 py-2 text-sm" disabled={loading}>
        {loading ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
