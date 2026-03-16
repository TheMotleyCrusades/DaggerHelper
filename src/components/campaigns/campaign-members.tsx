"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = {
  id: number;
  userId: number;
  role: string;
  user: {
    email: string;
    username: string | null;
    name: string | null;
  } | null;
};

export function CampaignMembers({
  campaignId,
  inviteCode,
  canManage,
}: {
  campaignId: number;
  inviteCode: string | null;
  canManage: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/campaigns/${campaignId}/members`, { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load members");
        setLoading(false);
        return;
      }

      setMembers(Array.isArray(data) ? data : []);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setAdding(true);
    const response = await fetch(`/api/campaigns/${campaignId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "player" }),
    });
    const data = await response.json();
    setAdding(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to add member");
      return;
    }

    setEmail("");
    setLoading(true);
    const reload = await fetch(`/api/campaigns/${campaignId}/members`, { cache: "no-store" });
    const reloadData = await reload.json();
    if (reload.ok) {
      setMembers(Array.isArray(reloadData) ? reloadData : []);
      setError(null);
    }
    setLoading(false);
  }

  async function removeMember(userId: number) {
    if (!canManage) return;
    const response = await fetch(`/api/campaigns/${campaignId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) {
      setMembers((current) => current.filter((member) => member.userId !== userId));
    }
  }

  async function copyInviteLink() {
    if (!inviteCode) return;
    const link = `${window.location.origin}/dashboard/campaigns?join=${inviteCode}`;
    await navigator.clipboard.writeText(link);
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg text-amber-200">Members</h3>
        {inviteCode && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span className="rounded-md border border-slate-700/60 px-2 py-1">Invite Code: {inviteCode}</span>
            <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={copyInviteLink} type="button">
              Copy Invite Link
            </button>
          </div>
        )}
      </div>

      {canManage && (
        <form className="flex flex-wrap gap-2" onSubmit={addMember}>
          <input
            className="field min-w-[220px] flex-1"
            type="email"
            required
            placeholder="Invite member by email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="btn-primary px-3 py-2 text-sm" disabled={adding}>
            {adding ? "Adding..." : "Add Member"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-slate-300">Loading members...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {members.map((member) => (
          <article key={member.id} className="rounded-md border border-slate-700/50 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-slate-100">
                  {member.user?.name || member.user?.username || member.user?.email || `User #${member.userId}`}
                </p>
                <p className="text-xs text-slate-400">
                  {member.user?.email ?? "Unknown email"} | {member.role}
                </p>
              </div>
              {canManage && member.role !== "gm" && (
                <button
                  className="rounded-md border border-red-400/45 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => removeMember(member.userId)}
                  type="button"
                >
                  Remove
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {!loading && !members.length && <p className="text-sm text-slate-300">No members yet.</p>}
    </section>
  );
}
