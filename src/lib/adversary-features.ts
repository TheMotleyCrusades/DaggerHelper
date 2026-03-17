import rawFeatures from "@/lib/adversary-features.json";

type RawAdversaryFeature = {
  id: number | string;
  title: string;
  type: string;
  tiers?: number[];
  roles?: string[];
  description: string;
  tags?: string[];
  isOfficial?: boolean;
};

export type AdversaryFeatureTemplate = {
  id: string;
  name: string;
  type: string;
  description: string;
  tiers?: number[];
  tags?: string[];
};

const typedRaw = rawFeatures as RawAdversaryFeature[];

export const ADVERSARY_FEATURES: AdversaryFeatureTemplate[] = typedRaw.map((feature) => ({
  id: String(feature.id),
  name: feature.title,
  type: feature.type,
  description: feature.description,
  tiers: feature.tiers,
  tags: [...(feature.tags ?? []), ...(feature.roles ?? [])].filter(Boolean),
}));

export function filterAdversaryFeatures(query: string, tier?: number) {
  const normalized = query.trim().toLowerCase();
  return ADVERSARY_FEATURES.filter((feature) => {
    const matchesQuery =
      !normalized ||
      feature.name.toLowerCase().includes(normalized) ||
      feature.description.toLowerCase().includes(normalized) ||
      (feature.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized));
    const matchesTier = tier ? !feature.tiers || feature.tiers.some((value) => value <= tier) : true;
    return matchesQuery && matchesTier;
  });
}
