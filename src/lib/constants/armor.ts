export type ArmorDefinition = {
  id: string;
  campaignId: number | null;
  name: string;
  baseThresholds: number;
  baseScore: number;
  feature: string;
  isOfficial: boolean;
};

export const OFFICIAL_ARMOR: ArmorDefinition[] = [
  {
    id: "armor-travel-leathers",
    campaignId: null,
    name: "Travel Leathers",
    baseThresholds: 7,
    baseScore: 1,
    feature: "Flexible layers keep movement silent in rough terrain.",
    isOfficial: true,
  },
  {
    id: "armor-warden-mail",
    campaignId: null,
    name: "Warden Mail",
    baseThresholds: 8,
    baseScore: 2,
    feature: "Balanced protection without sacrificing mobility.",
    isOfficial: true,
  },
  {
    id: "armor-bulwark-plate",
    campaignId: null,
    name: "Bulwark Plate",
    baseThresholds: 9,
    baseScore: 3,
    feature: "Heavy plating reduces forced movement effects.",
    isOfficial: true,
  },
  {
    id: "armor-shimmerweave",
    campaignId: null,
    name: "Shimmerweave",
    baseThresholds: 7,
    baseScore: 2,
    feature: "Arcane weave grants +1 evasion versus magical attacks.",
    isOfficial: true,
  },
  {
    id: "armor-ranger-cloak",
    campaignId: null,
    name: "Ranger Cloak",
    baseThresholds: 8,
    baseScore: 1,
    feature: "Camouflage grants advantage on first stealth check each scene.",
    isOfficial: true,
  },
];
