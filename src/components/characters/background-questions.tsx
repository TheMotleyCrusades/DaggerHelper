"use client";

import { getBackgroundQuestionTemplates } from "@/lib/constants/backgroundQuestions";

export function BackgroundQuestions({
  className,
  values,
  onChange,
}: {
  className?: string;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const templates = getBackgroundQuestionTemplates(className);

  return (
    <section className="space-y-3">
      {templates.map((question) => (
        <label key={question.id} className="block text-sm text-slate-300">
          <span className="mb-1 block text-slate-100">{question.prompt}</span>
          <span className="mb-1 block text-xs text-slate-400">{question.helper}</span>
          <textarea
            className="field min-h-24"
            value={values[question.id] ?? ""}
            onChange={(event) =>
              onChange({
                ...values,
                [question.id]: event.target.value,
              })
            }
            placeholder={question.example}
          />
        </label>
      ))}
    </section>
  );
}