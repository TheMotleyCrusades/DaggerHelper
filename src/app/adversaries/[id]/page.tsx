import { redirect } from "next/navigation";

export default async function LegacyAdversaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/community/adversaries/${id}`);
}
