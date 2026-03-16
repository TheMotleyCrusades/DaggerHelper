"use client";

type Props = {
  className: string;
  equipmentNotes: string;
  startingEquipmentByClass: Record<string, string>;
  onChange: (equipmentNotes: string) => void;
};

function normalizeMultiline(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function EquipmentStep({
  className,
  equipmentNotes,
  startingEquipmentByClass,
  onChange,
}: Props) {
  const classPackage =
    (className && startingEquipmentByClass[className]) || "No GM class package override configured.";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl text-amber-300">Step 6 - Equipment Notes</h2>
        <p className="text-sm text-slate-300">
          Add optional notes for unique gear, starting bundles, or reminders that do not affect combat stats.
        </p>
      </div>

      <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <p className="text-xs text-slate-400">GM Starting Package Preview</p>
        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">{classPackage}</p>
      </article>

      <label className="block text-sm text-slate-300">
        Supplemental Equipment Notes
        <textarea
          className="field mt-1 min-h-56"
          value={equipmentNotes}
          onChange={(event) => onChange(normalizeMultiline(event.target.value))}
          placeholder="Optional notes, packs, or custom starter gear text."
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-outline min-h-11 px-3 py-2 text-xs"
          type="button"
          onClick={() => onChange(classPackage)}
        >
          Insert GM Package
        </button>
        <button
          className="btn-outline min-h-11 px-3 py-2 text-xs"
          type="button"
          onClick={() => onChange("")}
        >
          Clear Notes
        </button>
      </div>
    </section>
  );
}
