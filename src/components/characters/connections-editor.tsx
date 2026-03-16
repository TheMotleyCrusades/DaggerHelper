"use client";

type Connection = {
  id: string;
  name: string;
  description: string;
};

function toConnection(input: Record<string, unknown>, index: number): Connection {
  const id = typeof input.id === "string" ? input.id : `connection-${index}`;
  const name = typeof input.name === "string" ? input.name : "";
  const description = typeof input.description === "string" ? input.description : "";
  return { id, name, description };
}

function toRecord(connection: Connection) {
  return {
    id: connection.id,
    name: connection.name,
    description: connection.description,
  };
}

export function ConnectionsEditor({
  values,
  onChange,
}: {
  values: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
}) {
  const normalized = values.map((item, index) => toConnection(item, index));

  function updateConnection(index: number, patch: Partial<Connection>) {
    onChange(
      normalized.map((connection, currentIndex) =>
        currentIndex === index ? toRecord({ ...connection, ...patch }) : toRecord(connection)
      )
    );
  }

  function addConnection() {
    const nextIndex =
      normalized.reduce((max, item) => {
        const match = item.id.match(/connection-(\d+)$/);
        if (!match) return max;
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0) + 1;

    const next = [
      ...normalized,
      {
        id: `connection-${nextIndex}`,
        name: "",
        description: "",
      },
    ];

    onChange(next.map((item) => toRecord(item)));
  }

  function removeConnection(id: string) {
    onChange(normalized.filter((item) => item.id !== id).map((item) => toRecord(item)));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg text-amber-200">Connections</h3>
        <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addConnection} type="button">
          Add Connection
        </button>
      </div>

      <div className="space-y-2">
        {normalized.map((connection, index) => (
          <article key={connection.id} className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="text-xs text-slate-300">
                Name / Party Member
                <input
                  className="field mt-1"
                  value={connection.name}
                  onChange={(event) => updateConnection(index, { name: event.target.value })}
                  placeholder="Who is this connection with?"
                />
              </label>

              <button
                className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                onClick={() => removeConnection(connection.id)}
                type="button"
              >
                Remove
              </button>
            </div>

            <label className="mt-2 block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-20"
                value={connection.description}
                onChange={(event) => updateConnection(index, { description: event.target.value })}
                placeholder="How are your stories linked?"
              />
            </label>
          </article>
        ))}
      </div>

      {!normalized.length && (
        <p className="text-sm text-slate-300">No connections yet. Add one to tie your character to the party.</p>
      )}
    </section>
  );
}
