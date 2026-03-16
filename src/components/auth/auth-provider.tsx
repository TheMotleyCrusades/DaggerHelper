"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SessionUser = {
  id: string;
  email?: string | null;
} | null;

type AppUser = {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  role: string | null;
} | null;

type AuthContextValue = {
  user: SessionUser;
  appUser: AppUser;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch auth session");
  }
  return (await response.json()) as { user: SessionUser; appUser: AppUser };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser>(null);
  const [appUser, setAppUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchSession();
      setUser(session.user ?? null);
      setAppUser(session.appUser ?? null);
    } catch {
      setUser(null);
      setAppUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      appUser,
      loading,
      refresh,
    }),
    [appUser, loading, refresh, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
