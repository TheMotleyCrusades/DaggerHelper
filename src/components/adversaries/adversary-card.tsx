import { ReactNode } from "react";

export type AdversaryCardData = {
  id: number;
  name: string;
  tier: number;
  type: string;
  description?: string | null;
  isPublic?: boolean | null;
  tags?: string[] | null;
  favouriteCount?: number;
};

export function AdversaryCard({
  adversary,
  actions,
}: {
  adversary: AdversaryCardData;
  actions?: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg text-amber-200">{adversary.name}</h3>
          <p className="text-xs text-slate-300">
            Tier {adversary.tier} | {adversary.type}
            {typeof adversary.isPublic === "boolean" ? ` | ${adversary.isPublic ? "Public" : "Private"}` : ""}
            {typeof adversary.favouriteCount === "number" ? ` | ${adversary.favouriteCount} favourites` : ""}
          </p>
          {adversary.description && <p className="mt-1 text-sm text-slate-300">{adversary.description}</p>}
          {!!adversary.tags?.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {adversary.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  );
}
