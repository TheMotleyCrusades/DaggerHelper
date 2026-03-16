"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const { refresh } = useAuth();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className={className ?? "btn-outline px-3 py-1.5 text-xs"}
      onClick={handleLogout}
    >
      Logout
    </button>
  );
}
