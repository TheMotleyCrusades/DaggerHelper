"use client";

import { BackgroundQuestions } from "@/components/characters/background-questions";
import { ConnectionsEditor } from "@/components/characters/connections-editor";
import { NarrativeEditor } from "@/components/characters/narrative-editor";

type Props = {
  className: string;
  backgroundQuestions: Record<string, string>;
  connections: Array<Record<string, unknown>>;
  narrativeBackstory: string;
  onChange: (patch: {
    backgroundQuestions?: Record<string, string>;
    connections?: Array<Record<string, unknown>>;
    narrativeBackstory?: string;
  }) => void;
};

export function BackgroundStoryStep({
  className,
  backgroundQuestions,
  connections,
  narrativeBackstory,
  onChange,
}: Props) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl text-amber-300">Step 7 - Background & Story</h2>
        <p className="text-sm text-slate-300">
          Flesh out your character history, relationships, and personal voice.
        </p>
      </div>

      <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <h3 className="mb-2 text-lg text-amber-200">Guided Questions</h3>
        <BackgroundQuestions
          className={className}
          values={backgroundQuestions}
          onChange={(next) => onChange({ backgroundQuestions: next })}
        />
      </article>

      <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <ConnectionsEditor
          values={connections}
          onChange={(next) => onChange({ connections: next })}
        />
      </article>

      <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <NarrativeEditor
          value={narrativeBackstory}
          onChange={(next) => onChange({ narrativeBackstory: next })}
        />
      </article>
    </section>
  );
}
