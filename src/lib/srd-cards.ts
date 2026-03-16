import dataset from "@/lib/data/srd-cards.json";

export type SrdCardCategory = "domain" | "subclass" | "community" | "ancestry";
export type SrdCardType =
  | "ability"
  | "spell"
  | "grimoire"
  | "foundation"
  | "specialization"
  | "mastery"
  | "community"
  | "ancestry";

export type SrdCardAsset = {
  filename: string;
  publicPath: string;
  page: number;
  row: number;
  column: number;
  width: number;
  height: number;
};

export type SrdCardBase = {
  id: string;
  slug: string;
  title: string;
  category: SrdCardCategory;
  type: SrdCardType;
  description: string;
  sequence: number;
  asset: SrdCardAsset;
  officialSource: {
    source: string;
    sourceUrl: string;
  };
};

export type SrdDomainCard = SrdCardBase & {
  category: "domain";
  type: "ability" | "spell" | "grimoire";
  domain: string;
  level: number;
  stressCost: number;
};

export type SrdSubclassCard = SrdCardBase & {
  category: "subclass";
  type: "foundation" | "specialization" | "mastery";
  className: string;
  subclassName: string;
  tier: "foundation" | "specialization" | "mastery";
  summary: string | null;
  spellcastTrait: string | null;
};

export type SrdCommunityCard = SrdCardBase & {
  category: "community";
  type: "community";
  communityName: string;
  personalityWords: string[];
};

export type SrdAncestryCard = SrdCardBase & {
  category: "ancestry";
  type: "ancestry";
  ancestryName: string;
};

export type SrdCard = SrdDomainCard | SrdSubclassCard | SrdCommunityCard | SrdAncestryCard;

export type SrdCardDataset = {
  version: string;
  generatedAt: string;
  source: {
    officialPdfUrl: string;
    imageManifest: string;
  };
  counts: {
    total: number;
    domain: number;
    subclass: number;
    community: number;
    ancestry: number;
  };
  cards: SrdCard[];
};

export const SRD_CARD_DATASET = dataset as SrdCardDataset;
export const SRD_CARDS = SRD_CARD_DATASET.cards;
export const SRD_DOMAIN_CARDS = SRD_CARDS.filter((card): card is SrdDomainCard => card.category === "domain");
export const SRD_SUBCLASS_CARDS = SRD_CARDS.filter((card): card is SrdSubclassCard => card.category === "subclass");
export const SRD_COMMUNITY_CARDS = SRD_CARDS.filter((card): card is SrdCommunityCard => card.category === "community");
export const SRD_ANCESTRY_CARDS = SRD_CARDS.filter((card): card is SrdAncestryCard => card.category === "ancestry");
