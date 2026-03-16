"use client";

import Link from "next/link";
import { EquipmentLibraryManager } from "@/components/equipment/library-manager";

export default function PersonalLibraryPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl text-amber-300">Equipment Library</h2>
        <p className="text-sm text-slate-300">
          Manage reusable equipment. This is the equipment wing of the World Creator Engine.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/dashboard/world" className="btn-outline min-h-11 px-3 py-2 text-xs">
            Open World Creator Engine
          </Link>
          <Link href="/dashboard/world/bundles" className="btn-outline min-h-11 px-3 py-2 text-xs">
            Open Bundle Manager
          </Link>
        </div>
      </div>

      <EquipmentLibraryManager
        scope="personal"
        title="Personal Catalog Manager"
        description="Personal entries are reusable across campaigns and can be cloned into campaign libraries by GMs."
      />
    </section>
  );
}
