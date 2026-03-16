import { notFound, redirect } from "next/navigation";
import { EquipmentLibraryManager } from "@/components/equipment/library-manager";
import { WorldKindManager } from "@/components/world/world-kind-manager";
import { getWorldKindConfigBySlug } from "@/components/world/world-kinds";

export default async function WorldKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const kind = (await params).kind;
  const config = getWorldKindConfigBySlug(kind);

  if (!config) {
    notFound();
  }

  if (kind === "adversaries") {
    redirect("/dashboard/adversaries");
  }

  if (kind === "weapons" || kind === "armor" || kind === "items" || kind === "consumables") {
    return (
      <EquipmentLibraryManager
        scope="personal"
        title="Personal Equipment Library"
        description="Manage weapons, armor, items, and consumables for your World Creator Engine catalog."
        initialTab={kind}
      />
    );
  }

  return <WorldKindManager config={config} />;
}
