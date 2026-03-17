import type { ChangeEvent } from "react";
import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";

export function Step6ImageTags({
  value,
  onChange,
  tagsInput,
  onTagsChange,
}: {
  value: AdversaryFormValue;
  onChange: (patch: Partial<AdversaryFormValue>) => void;
  tagsInput: string;
  onTagsChange: (next: string) => void;
}) {
  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onChange({ imageUrl: typeof reader.result === "string" ? reader.result : value.imageUrl });
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 6: Image & Tags</h2>
        <p className="text-sm text-slate-400">Add a visual and metadata for filtering.</p>
      </header>

      <label className="text-sm text-slate-300">
        Image URL
        <input
          className="field mt-1"
          value={value.imageUrl ?? ""}
          onChange={(event) => onChange({ imageUrl: event.target.value })}
          placeholder="https://..."
        />
      </label>

      <label className="text-sm text-slate-300">
        Upload Image (optional)
        <input className="field mt-1" type="file" accept="image/*" onChange={handleImageUpload} />
      </label>

      {value.imageUrl ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-2">
          <img src={value.imageUrl} alt="Adversary preview" className="max-h-64 w-full rounded-md object-cover" />
        </div>
      ) : null}

      <label className="text-sm text-slate-300">
        Tags (comma separated)
        <input
          className="field mt-1"
          value={tagsInput}
          onChange={(event) => onTagsChange(event.target.value)}
          placeholder="undead, boss, fire"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={value.isPublic ?? false}
          onChange={(event) => onChange({ isPublic: event.target.checked })}
        />
        Share publicly to community
      </label>
    </section>
  );
}
