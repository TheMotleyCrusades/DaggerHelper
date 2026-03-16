"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm transition ${
        active
          ? "bg-amber-700/35 text-amber-200"
          : "text-slate-300 hover:bg-slate-800 hover:text-amber-200"
      }`}
    >
      {label}
    </Link>
  );
}
