import { redirect } from "next/navigation";

export default async function DashboardCharacterDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/characters/${(await params).id}`);
}
