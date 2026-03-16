"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { useAuth } from "@/components/auth/auth-provider";

type QuickAction = {
  href: string;
  label: string;
};

function shouldHideTopNav(pathname: string) {
  if (!pathname) return false;
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname === "/register") return true;
  return false;
}

function routeQuickActions(pathname: string): QuickAction[] {
  const dashboardCampaignMatch = pathname.match(/^\/dashboard\/campaigns\/([^/]+)/);
  if (dashboardCampaignMatch) {
    const campaignId = dashboardCampaignMatch[1];
    const actions: QuickAction[] = [];
    const hudHref = `/campaigns/${campaignId}/hud`;
    const settingsHref = `/campaigns/${campaignId}/settings`;

    if (pathname !== `/dashboard/campaigns/${campaignId}`) {
      actions.push({ href: `/dashboard/campaigns/${campaignId}`, label: "Back to Campaign" });
    }
    actions.push({ href: hudHref, label: "Open HUD" });
    actions.push({ href: settingsHref, label: "Campaign Settings" });
    actions.push({ href: "/dashboard/campaigns", label: "All Campaigns" });
    return actions;
  }

  const campaignMatch = pathname.match(/^\/campaigns\/([^/]+)/);
  if (campaignMatch) {
    const campaignId = campaignMatch[1];
    const campaignHud = `/campaigns/${campaignId}/hud`;
    const campaignSettings = `/campaigns/${campaignId}/settings`;
    const actions: QuickAction[] = [];

    if (pathname !== campaignHud) {
      actions.push({ href: campaignHud, label: "Back to Campaign" });
    }
    if (pathname !== campaignSettings) {
      actions.push({ href: campaignSettings, label: "Campaign Settings" });
    }
    actions.push({ href: "/dashboard/campaigns", label: "All Campaigns" });
    return actions;
  }

  if (/^\/characters\/[^/]+\/edit$/.test(pathname)) {
    return [
      { href: pathname.replace(/\/edit$/, ""), label: "Back to Sheet" },
    ];
  }

  if (pathname.startsWith("/community/adversaries/")) {
    return [{ href: "/community", label: "Back to Community" }];
  }

  if (pathname.startsWith("/share/")) {
    return [{ href: "/community", label: "Browse Community" }];
  }

  return [];
}

export function GlobalTopNav() {
  const pathname = usePathname() || "";
  const { user, loading } = useAuth();
  const quickActions = routeQuickActions(pathname);

  if (shouldHideTopNav(pathname)) {
    return null;
  }

  return (
    <header className="border-b border-slate-700/50 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="text-sm text-amber-200 hover:text-amber-100">
            Home
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-300 hover:text-amber-200">
            Dashboard
          </Link>
          <Link href="/community" className="text-sm text-slate-300 hover:text-amber-200">
            Community Library
          </Link>
          {quickActions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="rounded-md border border-slate-600/60 px-2 py-1 text-xs text-slate-200 hover:border-amber-400/40 hover:text-amber-200"
            >
              {action.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-slate-400">Checking session...</span>
          ) : user ? (
            <>
              <Link href="/dashboard" className="btn-outline min-h-11 px-3 py-2 text-xs">
                Open Dashboard
              </Link>
              <LogoutButton className="btn-outline min-h-11 px-3 py-2 text-xs" />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-outline min-h-11 px-3 py-2 text-xs">
                Login
              </Link>
              <Link href="/register" className="btn-primary min-h-11 px-3 py-2 text-xs">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
