export type BackgroundQuestion = {
  id: string;
  prompt: string;
  helper: string;
  example: string;
};

function normalizeClassToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const BACKGROUND_QUESTION_TEMPLATES: BackgroundQuestion[] = [
  {
    id: "origin",
    prompt: "What event first set you on this path?",
    helper: "Name one person, one place, and one cost tied to this moment.",
    example: "When the Ember Chapel burned, I stole the map that led me to the party.",
  },
  {
    id: "scar",
    prompt: "What scar, vow, or burden still shapes your choices?",
    helper: "Focus on how it changes your behavior at the table.",
    example: "I refuse to leave wounded allies behind, even when retreat is wiser.",
  },
  {
    id: "goal",
    prompt: "What are you trying to achieve this campaign?",
    helper: "Keep this concrete so the GM can hook it into scenes.",
    example: "Recover my mentor's codex before the Ash Regent deciphers it.",
  },
  {
    id: "fear",
    prompt: "What fear or temptation could make you fail?",
    helper: "Choose something that can create difficult decisions.",
    example: "I overreach for power whenever I feel outmatched.",
  },
];

const CLASS_QUESTION_OVERRIDES: Record<string, BackgroundQuestion[]> = {
  bard: [
    {
      id: "origin",
      prompt: "What performance, speech, or story first proved your voice had power?",
      helper: "Name the audience and what changed because of your words.",
      example: "My ballad ended a dock strike, and now every guildmaster in the city knows my name.",
    },
    {
      id: "scar",
      prompt: "What truth are you afraid to put into words?",
      helper: "Pick something that can surface in tense social scenes.",
      example: "I know who funded the war songs, but saying it out loud could shatter our alliance.",
    },
    {
      id: "goal",
      prompt: "What stage, court, or gathering are you trying to reach?",
      helper: "Choose a concrete venue or event the GM can place in the campaign.",
      example: "I need to perform at the Ember Assembly and turn the council against the regent.",
    },
    {
      id: "fear",
      prompt: "What reaction from the crowd terrifies you most?",
      helper: "Tie this fear to a past failure or betrayal.",
      example: "If they stop listening, I lose control and start saying whatever hurts the most.",
    },
  ],
  druid: [
    {
      id: "origin",
      prompt: "What place in the wild first answered you?",
      helper: "Describe one sensory detail that still anchors your power.",
      example: "A stone ring in a storm-soaked marsh whispered my name with every lightning strike.",
    },
    {
      id: "scar",
      prompt: "What wound did nature leave on you when you ignored its warning?",
      helper: "Show how that event changed your habits.",
      example: "I crossed a blighted river too quickly, and now I never travel without tasting the water first.",
    },
    {
      id: "goal",
      prompt: "What cycle, spirit, or sanctuary are you trying to protect?",
      helper: "Choose something that can be threatened across multiple sessions.",
      example: "I must restore the withered grove before the next moonfall or the valley dies.",
    },
    {
      id: "fear",
      prompt: "What sign tells you the natural balance is slipping beyond your reach?",
      helper: "Pick a warning the whole party can notice.",
      example: "When birds fall silent at dawn, I know the corruption is already ahead of us.",
    },
  ],
  guardian: [
    {
      id: "origin",
      prompt: "Who did you swear to protect, and what did that oath cost you?",
      helper: "Anchor this to one person or community your character still thinks about.",
      example: "I swore to defend the Frostgate refugees after failing to save my sister.",
    },
    {
      id: "scar",
      prompt: "What battlefield memory still keeps you awake?",
      helper: "Choose a memory that affects how you make tactical choices now.",
      example: "I froze during an ambush once, so I now overcommit to protecting the rear line.",
    },
    {
      id: "goal",
      prompt: "What must you secure before you can finally stand down?",
      helper: "Make this an objective the GM can put in front of the party.",
      example: "I need to reclaim the border watchtower and re-open the old pass.",
    },
    {
      id: "fear",
      prompt: "What failure would make you believe you are unfit to lead?",
      helper: "Pick a fear that can show up during high-pressure moments.",
      example: "If my command gets an ally killed, I will stop trusting my own judgment.",
    },
  ],
  rogue: [
    {
      id: "origin",
      prompt: "What score or betrayal pulled you into this life?",
      helper: "Include who set you up or who taught you the trick.",
      example: "I stole from the wrong broker and had to disappear overnight.",
    },
    {
      id: "scar",
      prompt: "What personal rule keeps you from becoming a monster?",
      helper: "This should be a line you almost cross under pressure.",
      example: "I never rob people who cannot fight back.",
    },
    {
      id: "goal",
      prompt: "What one prize would let you quit for good?",
      helper: "Make the prize tangible and campaign-usable.",
      example: "A black ledger listing every corrupt magistrate in this city.",
    },
    {
      id: "fear",
      prompt: "What weakness can your enemies exploit if they learn it?",
      helper: "Tie it to a person, place, or pattern.",
      example: "I cannot leave my old crew behind if they call for help.",
    },
  ],
  ranger: [
    {
      id: "origin",
      prompt: "What trail, omen, or hunt first marked your path?",
      helper: "Describe the sign and where it appeared.",
      example: "I tracked a silver-horned beast into a ruined watchpost and found my calling.",
    },
    {
      id: "scar",
      prompt: "What did the wilds take from you, and what did they teach you instead?",
      helper: "Show the tradeoff in one sentence.",
      example: "The winter took my mentor but taught me never to camp without two exits.",
    },
    {
      id: "goal",
      prompt: "What threat are you trying to map, corner, or prevent?",
      helper: "Pick a danger that can recur across sessions.",
      example: "I am tracking a migrating horror before it reaches settled lands.",
    },
    {
      id: "fear",
      prompt: "What sign tells you that your instincts are failing?",
      helper: "Choose something your allies might notice too.",
      example: "When I ignore small tracks, someone always pays for it.",
    },
  ],
  seraph: [
    {
      id: "origin",
      prompt: "When did hope or faith answer you for the first time?",
      helper: "Tie it to a specific place and witness.",
      example: "At a plague camp, a dying child smiled after my prayer took hold.",
    },
    {
      id: "scar",
      prompt: "What doubt shadows your calling?",
      helper: "Give your GM a moral conflict they can test.",
      example: "I fear my miracles only work when someone else suffers the cost.",
    },
    {
      id: "goal",
      prompt: "What community or cause are you trying to restore?",
      helper: "Keep it concrete and local enough for scenes.",
      example: "I want to rebuild the Lantern Hospice before winter arrives.",
    },
    {
      id: "fear",
      prompt: "What would make you break your vows?",
      helper: "Pick a pressure point the story can actually hit.",
      example: "If my order harms innocents again, I might turn on them.",
    },
  ],
  sorcerer: [
    {
      id: "origin",
      prompt: "How did your power first break containment?",
      helper: "Describe who saw it and the fallout.",
      example: "My pulse shattered every window in the observatory during final rites.",
    },
    {
      id: "scar",
      prompt: "What consequence reminds you your magic is dangerous?",
      helper: "Connect this to a visible habit or ritual.",
      example: "I count breaths before casting after nearly burning a friend alive.",
    },
    {
      id: "goal",
      prompt: "What truth about your power are you desperate to uncover?",
      helper: "This should point toward a person, site, or artifact.",
      example: "I need to locate the first stormglass lens tied to my bloodline.",
    },
    {
      id: "fear",
      prompt: "What happens if you lose control again?",
      helper: "Choose a consequence the table will feel.",
      example: "If I snap in a crowded place, I will never be trusted again.",
    },
  ],
  warrior: [
    {
      id: "origin",
      prompt: "What victory or defeat forged your fighting style?",
      helper: "Name the duel, battle, or mentor that shaped it.",
      example: "I survived the Iron Steps by fighting in pairs and never forgot it.",
    },
    {
      id: "scar",
      prompt: "What promise did you make after your worst fight?",
      helper: "Pick a promise that can clash with party goals.",
      example: "I swore to never leave an enemy commander alive to regroup.",
    },
    {
      id: "goal",
      prompt: "What challenge must you overcome to prove yourself now?",
      helper: "Make it something more than simple glory.",
      example: "I need to defeat the warlord who taught me and free their recruits.",
    },
    {
      id: "fear",
      prompt: "What weakness do you hide behind confidence?",
      helper: "This should appear in both social and combat play.",
      example: "I mask how bad my old wound is because I cannot stand being benched.",
    },
  ],
  wizard: [
    {
      id: "origin",
      prompt: "Which lesson, text, or experiment changed your understanding of magic?",
      helper: "Include where you learned it and who paid for that discovery.",
      example: "I opened a sealed codex in the observatory and burned my teacher's hand with the backlash.",
    },
    {
      id: "scar",
      prompt: "What rule do you follow to avoid repeating your worst magical mistake?",
      helper: "Make this a rule the story can pressure you to break.",
      example: "I never cast from memory alone after one rushed incantation shattered our ward circle.",
    },
    {
      id: "goal",
      prompt: "What piece of knowledge are you pursuing at any cost?",
      helper: "Point to a person, archive, relic, or forbidden site.",
      example: "I am hunting the first war theorem hidden beneath the Ruined Athenaeum.",
    },
    {
      id: "fear",
      prompt: "What happens if your research is weaponized by the wrong hands?",
      helper: "Choose a consequence that creates urgent stakes for the party.",
      example: "If my sigil lattice is copied, it could turn every city gate into a trap.",
    },
  ],
};

export function getBackgroundQuestionTemplates(classId?: string) {
  if (!classId) return BACKGROUND_QUESTION_TEMPLATES;
  const normalized = normalizeClassToken(classId);
  return CLASS_QUESTION_OVERRIDES[normalized] ?? BACKGROUND_QUESTION_TEMPLATES;
}
