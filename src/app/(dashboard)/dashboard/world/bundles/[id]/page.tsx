import Link from "next/link";
import { WorldBundleEditor } from "@/components/world/world-bundle-editor";

export default async function WorldBundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;

  return (
    <section className="space-y-3">
      <Link
        href="/dashboard/world/bundles"
        className="btn-outline inline-flex min-h-11 items-center px-3 py-2 text-xs"
      >
        Back to Bundles
      </Link>
      <WorldBundleEditor productId={id} />
    </section>
  );
}
