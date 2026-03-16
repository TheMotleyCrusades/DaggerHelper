export const TRAIT_KEYS = [
  "agility",
  "strength",
  "finesse",
  "instinct",
  "presence",
  "knowledge",
] as const;

export type TraitKey = (typeof TRAIT_KEYS)[number];
export type TraitMap = Record<TraitKey, number>;

export type ClassDefinition = {
  id: string;
  label: string;
  description: string;
  classDomains: [string, string];
  startingEvasion: number;
  startingHp: number;
  classItems: string;
  hopeFeatureName: string;
  hopeFeatureSummary: string;
  classFeatureName: string;
  classFeatureSummary: string;
  recommendedTraits: TraitMap;
  recommendedPrimaryWeaponId: string;
  recommendedSecondaryWeaponId: string;
  recommendedArmorId: string;
  startingEquipment: string;
  subclasses: string[];
};

export const CLASS_DEFINITIONS: ClassDefinition[] = [
  {
    id: "bard",
    label: "Bard",
    description: "Charismatic performer who inspires allies and bends social momentum.",
    classDomains: ["codex", "grace"],
    startingEvasion: 10,
    startingHp: 5,
    classItems: "A romance novel or a letter never opened.",
    hopeFeatureName: "Make a Scene",
    hopeFeatureSummary:
      "Spend 3 Hope to temporarily Distract a target within Close range and lower their Difficulty.",
    classFeatureName: "Rally",
    classFeatureSummary:
      "Once per session, grant Rally Dice to the party to boost rolls or clear Stress.",
    recommendedTraits: {
      agility: 1,
      strength: -1,
      finesse: 0,
      instinct: 0,
      presence: 2,
      knowledge: 1,
    },
    recommendedPrimaryWeaponId: "weapon-sigil-orb",
    recommendedSecondaryWeaponId: "weapon-rapier",
    recommendedArmorId: "armor-shimmerweave",
    startingEquipment: [
      "- Instrument or spoken-word focus",
      "- Performance attire with travel modifications",
      "- Journal of songs, stories, or speeches",
      "- Rations (2 days)",
      "- A keepsake from your first audience",
    ].join("\n"),
    subclasses: ["Troubadour", "Wordsmith"],
  },
  {
    id: "druid",
    label: "Druid",
    description: "Warden of the wilds who shifts form and channels primal magic.",
    classDomains: ["arcana", "sage"],
    startingEvasion: 10,
    startingHp: 6,
    classItems: "A small bag of rocks and bones or a natural talisman.",
    hopeFeatureName: "Evolution",
    hopeFeatureSummary:
      "Spend 3 Hope to transform into a Beastform from your available tier.",
    classFeatureName: "Beastform",
    classFeatureSummary:
      "Mark Stress to transform and gain form-specific features, attack trait, and Evasion bonus.",
    recommendedTraits: {
      agility: 0,
      strength: 1,
      finesse: -1,
      instinct: 2,
      presence: 0,
      knowledge: 1,
    },
    recommendedPrimaryWeaponId: "weapon-staff",
    recommendedSecondaryWeaponId: "weapon-daggers",
    recommendedArmorId: "armor-ranger-cloak",
    startingEquipment: [
      "- Herbalist satchel and bandages",
      "- Elemental focus (stone, shell, bone, or wood)",
      "- Weathered travel cloak",
      "- Rations (3 days)",
      "- Token from your circle",
    ].join("\n"),
    subclasses: ["Warden of the Elements", "Warden of Renewal"],
  },
  {
    id: "guardian",
    label: "Guardian",
    description: "Front-line protector built to absorb pressure and anchor the party.",
    classDomains: ["blade", "valor"],
    startingEvasion: 9,
    startingHp: 7,
    classItems: "A totem from your mentor or a secret key.",
    hopeFeatureName: "Frontline Tank",
    hopeFeatureSummary: "Spend 3 Hope to clear 2 Armor Slots.",
    classFeatureName: "Unstoppable",
    classFeatureSummary:
      "Once per long rest, become Unstoppable to reduce incoming physical damage and boost your own.",
    recommendedTraits: {
      agility: 0,
      strength: 2,
      finesse: 0,
      instinct: 1,
      presence: 1,
      knowledge: -1,
    },
    recommendedPrimaryWeaponId: "weapon-warhammer",
    recommendedSecondaryWeaponId: "weapon-longsword",
    recommendedArmorId: "armor-bulwark-plate",
    startingEquipment: [
      "- Adventuring pack",
      "- Guard insignia or oath token",
      "- 50 ft. rope",
      "- Rations (3 days)",
      "- Traveler's blanket",
    ].join("\n"),
    subclasses: ["Stalwart", "Vengeance"],
  },
  {
    id: "rogue",
    label: "Rogue",
    description: "Stealth specialist with precision burst damage and infiltration tools.",
    classDomains: ["grace", "midnight"],
    startingEvasion: 12,
    startingHp: 6,
    classItems: "A set of forgery tools or a grappling hook.",
    hopeFeatureName: "Rogue's Dodge",
    hopeFeatureSummary:
      "Spend 3 Hope to gain +2 Evasion against one incoming attack.",
    classFeatureName: "Sneak Attack",
    classFeatureSummary:
      "Add bonus damage dice when striking while Cloaked or while an ally engages your target.",
    recommendedTraits: {
      agility: 2,
      strength: -1,
      finesse: 1,
      instinct: 1,
      presence: 0,
      knowledge: 0,
    },
    recommendedPrimaryWeaponId: "weapon-rapier",
    recommendedSecondaryWeaponId: "weapon-daggers",
    recommendedArmorId: "armor-travel-leathers",
    startingEquipment: [
      "- Fine lockpick set",
      "- Concealable tool roll",
      "- Hooded cloak",
      "- Rations (2 days)",
      "- Small keepsake from a former mark",
    ].join("\n"),
    subclasses: ["Nightwalker", "Syndicate"],
  },
  {
    id: "ranger",
    label: "Ranger",
    description: "Adaptive hunter with target focus, mobility, and battlefield control.",
    classDomains: ["bone", "sage"],
    startingEvasion: 12,
    startingHp: 6,
    classItems: "A trophy from your first kill or a seemingly mundane keepsake.",
    hopeFeatureName: "Hold Them Off",
    hopeFeatureSummary:
      "Spend 3 Hope after a successful attack to drive the target back and control their position.",
    classFeatureName: "Ranger's Focus",
    classFeatureSummary:
      "Mark a target as your Focus to track them, pressure them, and trigger reroll options.",
    recommendedTraits: {
      agility: 1,
      strength: 0,
      finesse: 1,
      instinct: 2,
      presence: -1,
      knowledge: 0,
    },
    recommendedPrimaryWeaponId: "weapon-shortbow",
    recommendedSecondaryWeaponId: "weapon-daggers",
    recommendedArmorId: "armor-ranger-cloak",
    startingEquipment: [
      "- Field pack",
      "- Marking chalk and trail twine",
      "- Campfire kit",
      "- Rations (4 days)",
      "- Weathered map fragment",
    ].join("\n"),
    subclasses: ["Beastbound", "Wayfinder"],
  },
  {
    id: "seraph",
    label: "Seraph",
    description: "Radiant protector who supports allies through faith and miracles.",
    classDomains: ["splendor", "valor"],
    startingEvasion: 9,
    startingHp: 7,
    classItems: "A bundle of offerings or a sigil of your god.",
    hopeFeatureName: "Life Support",
    hopeFeatureSummary:
      "Spend 3 Hope to clear a Hit Point on an ally within range.",
    classFeatureName: "Prayer Dice",
    classFeatureSummary:
      "Start each session with Prayer Dice that can reduce damage, boost outcomes, or restore Hope.",
    recommendedTraits: {
      agility: 0,
      strength: -1,
      finesse: 0,
      instinct: 1,
      presence: 2,
      knowledge: 1,
    },
    recommendedPrimaryWeaponId: "weapon-sigil-orb",
    recommendedSecondaryWeaponId: "weapon-staff",
    recommendedArmorId: "armor-shimmerweave",
    startingEquipment: [
      "- Consecrated focus",
      "- Prayer or vow book",
      "- Small healer's pouch",
      "- Rations (2 days)",
      "- Symbol of your order",
    ].join("\n"),
    subclasses: ["Divine Wielder", "Winged Sentinel"],
  },
  {
    id: "sorcerer",
    label: "Sorcerer",
    description: "Volatile spellcaster wielding raw magical force and instability.",
    classDomains: ["arcana", "midnight"],
    startingEvasion: 10,
    startingHp: 6,
    classItems: "A whispering orb or a family heirloom.",
    hopeFeatureName: "Volatile Magic",
    hopeFeatureSummary:
      "Spend 3 Hope to reroll any number of your Duality Dice during a spell action.",
    classFeatureName: "Channel Raw Power",
    classFeatureSummary:
      "Convert a domain card into immediate fuel: gain Hope or amplify a damaging spell.",
    recommendedTraits: {
      agility: 0,
      strength: -1,
      finesse: 0,
      instinct: 1,
      presence: 1,
      knowledge: 2,
    },
    recommendedPrimaryWeaponId: "weapon-staff",
    recommendedSecondaryWeaponId: "weapon-sigil-orb",
    recommendedArmorId: "armor-shimmerweave",
    startingEquipment: [
      "- Arcane notes and charcoal",
      "- Spell component satchel",
      "- Candle and chalk set",
      "- Rations (2 days)",
      "- Personal magical trinket",
    ].join("\n"),
    subclasses: ["Elemental Origin", "Primal Origin"],
  },
  {
    id: "warrior",
    label: "Warrior",
    description: "Weapon specialist with reliable pressure and close-combat control.",
    classDomains: ["blade", "bone"],
    startingEvasion: 11,
    startingHp: 6,
    classItems: "The drawing of a lover or a sharpening stone.",
    hopeFeatureName: "No Mercy",
    hopeFeatureSummary:
      "Spend 3 Hope to gain +1 on your next attack and convert pressure into damage.",
    classFeatureName: "Attack of Opportunity",
    classFeatureSummary:
      "Punish enemies leaving your melee range by stopping movement, dealing damage, or following.",
    recommendedTraits: {
      agility: 1,
      strength: 2,
      finesse: 0,
      instinct: 0,
      presence: 1,
      knowledge: -1,
    },
    recommendedPrimaryWeaponId: "weapon-longsword",
    recommendedSecondaryWeaponId: "weapon-warhammer",
    recommendedArmorId: "armor-warden-mail",
    startingEquipment: [
      "- Adventuring pack",
      "- Sharpening kit",
      "- Spare weapon straps",
      "- Rations (3 days)",
      "- Banner scrap or battle token",
    ].join("\n"),
    subclasses: ["Call of the Brave", "Call of the Slayer"],
  },
  {
    id: "wizard",
    label: "Wizard",
    description: "Scholarly caster who weaponizes study, patterns, and arcane precision.",
    classDomains: ["codex", "splendor"],
    startingEvasion: 11,
    startingHp: 5,
    classItems: "A book you're trying to translate or a tiny arcane focus.",
    hopeFeatureName: "Not This Time",
    hopeFeatureSummary:
      "Spend 3 Hope to interrupt an adversary plan and force a disruptive magical shift.",
    classFeatureName: "Strange Patterns",
    classFeatureSummary:
      "Choose a Duality number to trigger Hope gain or Stress clearing when it appears.",
    recommendedTraits: {
      agility: 0,
      strength: -1,
      finesse: 0,
      instinct: 1,
      presence: 1,
      knowledge: 2,
    },
    recommendedPrimaryWeaponId: "weapon-staff",
    recommendedSecondaryWeaponId: "weapon-sigil-orb",
    recommendedArmorId: "armor-shimmerweave",
    startingEquipment: [
      "- Spellbook and annotation kit",
      "- Focus crystal or etched wand",
      "- Arcane components pouch",
      "- Rations (2 days)",
      "- Notes from a former mentor",
    ].join("\n"),
    subclasses: ["School of Knowledge", "School of War"],
  },
];

export const HERITAGE_OPTIONS = [
  "Clank",
  "Drakona",
  "Dwarf",
  "Elf",
  "Faerie",
  "Faun",
  "Firbolg",
  "Fungril",
  "Galapa",
  "Giant",
  "Goblin",
  "Halfling",
  "Human",
  "Infernis",
  "Katari",
  "Orc",
  "Ribbet",
  "Simiah",
];

export function getClassDefinition(classId: string) {
  return CLASS_DEFINITIONS.find((item) => item.id === classId) ?? null;
}
