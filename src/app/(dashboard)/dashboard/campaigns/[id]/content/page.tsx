import Link from "next/link";
import { CampaignContentManager } from "@/components/campaigns/campaign-content-manager";

function parseCampaignId(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
}

export default async function CampaignContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const campaignId = parseCampaignId((await params).id);

  if (!campaignId) {
    return <p className="text-sm text-red-400">Invalid campaign id.</p>;
  }

  return (
    <section className="space-y-3">
      <Link
        href={`/dashboard/campaigns/${campaignId}`}
        className="btn-outline inline-flex min-h-11 items-center px-3 py-2 text-xs"
      >
        Back to Campaign
      </Link>
      <CampaignContentManager campaignId={campaignId} />
    </section>
  );
}
