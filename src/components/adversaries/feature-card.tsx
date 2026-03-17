import type { AdversaryFeatureTemplate } from "@/lib/adversary-features";

export function FeatureCard({
  feature,
  onAdd,
  disabled,
}: {
  feature: AdversaryFeatureTemplate;
  onAdd: (feature: AdversaryFeatureTemplate) => void;
  disabled?: boolean;
}) {
  return (
    <article className="rounded-lg border border-slate-700/50 bg-slate-950/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-amber-200">{feature.name}</p>
          <p className="text-xs text-slate-400">{feature.type}</p>
        </div>
        {feature.tiers && feature.tiers.length ? (
          <span className="rounded-full border border-slate-600/60 px-2 py-0.5 text-[11px] text-slate-300">
            Tier {feature.tiers.join(", ")}
          </span>
        ) : null}
      </div>
      {feature.description ? <p className="mt-2 text-xs text-slate-300">{feature.description}</p> : null}
      <div className="mt-3">
        <button
          type="button"
          className="btn-outline min-h-9 px-3 py-1 text-xs"
          onClick={() => onAdd(feature)}
          disabled={disabled}
        >
          Add Feature
        </button>
      </div>
    </article>
  );
}
