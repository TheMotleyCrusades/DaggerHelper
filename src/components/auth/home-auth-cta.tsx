"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { useAuth } from "@/components/auth/auth-provider";

export function HomeAuthCta() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-sm text-slate-300">Checking session...</p>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-primary px-4 py-2 text-sm">
          Open Dashboard
        </Link>
        <LogoutButton className="btn-outline px-4 py-2 text-sm" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="btn-outline px-4 py-2 text-sm">
        Login
      </Link>
      <Link href="/register" className="btn-primary px-4 py-2 text-sm">
        Register
      </Link>
    </div>
  );
}
