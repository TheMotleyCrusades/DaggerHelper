"use client";

import { useMemo, useState } from "react";
import { FeatureCard } from "@/components/adversaries/feature-card";
import type { AdversaryFeature } from "@/components/adversaries/adversary-types";
import { ADVERSARY_FEATURES, filterAdversaryFeatures } from "@/lib/adversary-features";

export function FeatureSelector({
  value,
  onChange,
  tier,
}: {
  value: AdversaryFeature[];
  onChange: (next: AdversaryFeature[]) => void;
  tier: number;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => filterAdversaryFeatures(search, tier), [search, tier]);

  function addFeature(template: { name: string; type: string; description: string }) {
    onChange([...value, { name: template.name, type: template.type, description: template.description }]);
  }

  function updateFeature(index: number, patch: Partial<AdversaryFeature>) {
    onChange(value.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function removeFeature(index: number) {
    onChange(value.filter((_, idx) => idx !== index));
  }

  function addCustomFeature() {
    onChange([...value, { name: "", type: "standard", description: "" }]);
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg text-amber-200">Features</h3>
        <p className="text-xs text-slate-400">
          Pick from curated features or add your own. Tier {tier} suggestions appear first.
        </p>
      </div>

      <label className="text-xs text-slate-300">
        Search features
        <input
          className="field mt-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or tag"
        />
      </label>

      {ADVERSARY_FEATURES.length === 0 ? (
        <p className="text-xs text-amber-200">
          No curated features are loaded yet. You can still add custom features below.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} onAdd={addFeature} />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-700/50 bg-slate-950/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm text-amber-200">Selected Features</h4>
          <button type="button" className="btn-outline min-h-9 px-3 py-1 text-xs" onClick={addCustomFeature}>
            Add Custom Feature
          </button>
        </div>
        {value.length === 0 ? (
          <p className="text-xs text-slate-400">No features added yet.</p>
        ) : (
          <div className="space-y-2">
            {value.map((feature, index) => (
              <div key={`${feature.name}-${index}`} className="grid gap-2 rounded-md border border-slate-700/60 p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-slate-300">
                    Name
                    <input
                      className="field mt-1"
                      value={feature.name}
                      onChange={(event) => updateFeature(index, { name: event.target.value })}
                      placeholder="Feature name"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Type
                    <input
                      className="field mt-1"
                      value={feature.type}
                      onChange={(event) => updateFeature(index, { type: event.target.value })}
                      placeholder="standard"
                    />
                  </label>
                </div>
                <label className="text-xs text-slate-300">
                  Description
                  <textarea
                    className="field mt-1 min-h-20"
                    value={feature.description}
                    onChange={(event) => updateFeature(index, { description: event.target.value })}
                    placeholder="Describe the feature"
                  />
                </label>
                <div>
                  <button
                    type="button"
                    className="btn-outline min-h-9 px-3 py-1 text-xs"
                    onClick={() => removeFeature(index)}
                  >
                    Remove Feature
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
