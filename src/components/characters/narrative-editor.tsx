"use client";

export function NarrativeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const count = value.length;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg text-amber-200">Narrative Backstory</h3>
        <span className="text-xs text-slate-400">{count} chars</span>
      </div>

      <textarea
        className="field min-h-40"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write a short narrative that anchors your character's motivations and tone."
      />
      <p className="text-xs text-slate-400">
        Tip: include one past event, one current goal, and one unresolved tension.
      </p>
    </section>
  );
}
