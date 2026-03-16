import { redirect } from "next/navigation";
import { getSessionUser, getOrCreateAppUser } from "@/lib/auth";
import { NavLink } from "@/components/dashboard/nav-link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  await getOrCreateAppUser(user);

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-8">
      <section className="panel mb-4 rounded-lg px-4 py-3">
        <h1 className="text-xl text-amber-300">Dashboard</h1>
        <p className="text-xs text-slate-300">Contextual navigation for campaign management and creation tools.</p>
        <nav className="mt-3 flex flex-wrap gap-1">
          <NavLink href="/dashboard" label="Overview" />
          <NavLink href="/dashboard/world" label="World Creator Engine" />
          <NavLink href="/dashboard/campaigns" label="Campaigns" />
          <NavLink href="/dashboard/encounters" label="Encounters" />
          <NavLink href="/dashboard/characters" label="Characters" />
          <NavLink href="/dashboard/moderation" label="Moderation" />
          <NavLink href="/dashboard/settings" label="Settings" />
        </nav>
      </section>

      <main className="panel rounded-lg p-4">{children}</main>
    </div>
  );
}
