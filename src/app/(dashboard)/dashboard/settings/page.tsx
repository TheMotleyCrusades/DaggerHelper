"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

type Profile = {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  role: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { push } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/users/me", { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load settings");
        push(data.error ?? "Failed to load settings", "error");
        setLoading(false);
        return;
      }

      setProfile(data);
      setName(data.name ?? "");
      setUsername(data.username ?? "");
      setNewEmail(data.email ?? "");
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [push]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username }),
    });
    const data = await response.json();
    setSavingProfile(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save profile");
      push(data.error ?? "Failed to save profile", "error");
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            name: data.name ?? null,
            username: data.username ?? null,
          }
        : current
    );
    setMessage("Profile updated.");
    push("Profile updated.", "success");
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEmail(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });
    const data = await response.json();
    setSavingEmail(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to request email change");
      push(data.error ?? "Failed to request email change", "error");
      return;
    }

    setMessage(data.message ?? "Email change requested.");
    push(data.message ?? "Email change requested.", "success");
  }

  async function deleteAccount() {
    if (!confirm("Delete your account? This action cannot be undone.")) return;
    setDeleting(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/users/me", { method: "DELETE" });
    const data = await response.json();
    setDeleting(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to delete account");
      push(data.error ?? "Failed to delete account", "error");
      return;
    }

    push("Account deleted.", "success");
    router.push("/login");
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl text-amber-300">Settings</h2>
        <p className="text-slate-300">Manage profile, email updates, and account lifecycle.</p>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading settings...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {!loading && profile && (
        <>
          <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
            <h3 className="mb-3 text-lg text-amber-200">Profile</h3>
            <form className="space-y-3" onSubmit={saveProfile}>
              <label className="text-sm text-slate-300">
                Display Name
                <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="text-sm text-slate-300">
                Username
                <input
                  className="field mt-1"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <p className="text-xs text-slate-400">Role: {profile.role ?? "user"}</p>
              <button className="btn-primary px-4 py-2 text-sm" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
            <h3 className="mb-3 text-lg text-amber-200">Email</h3>
            <form className="space-y-3" onSubmit={saveEmail}>
              <label className="text-sm text-slate-300">
                Email Address
                <input
                  className="field mt-1"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              </label>
              <button className="btn-outline px-4 py-2 text-sm" disabled={savingEmail}>
                {savingEmail ? "Sending..." : "Change Email"}
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-red-400/30 bg-red-950/15 p-4">
            <h3 className="mb-2 text-lg text-red-300">Danger Zone</h3>
            <p className="mb-3 text-sm text-red-200/85">Deleting your account removes profile access permanently.</p>
            <button
              className="rounded-md border border-red-400/50 px-4 py-2 text-sm text-red-300 hover:bg-red-950/25"
              disabled={deleting}
              onClick={deleteAccount}
              type="button"
            >
              {deleting ? "Deleting..." : "Delete Account"}
            </button>
          </article>
        </>
      )}
    </section>
  );
}
