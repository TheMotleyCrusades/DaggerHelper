# GM Console Customization Expansion

Updated: 2026-03-14
Workspace: `C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next`

## Goal

Make the GM console the single control plane for campaign-level character rules, sheet layout, terminology, currencies, custom resources, and homebrew content so the app supports official Daggerheart play, table hacks, and heavier homebrew campaigns without hard-coded assumptions.

This proposal intentionally covers the full set of recurring community needs gathered from Daggerheart and adjacent D&D homebrew tooling:

- editable resource caps such as max Hope
- currency model changes such as coins instead of handfuls
- arbitrary custom resource trackers
- terminology overrides
- custom skills, labels, and roll language
- broader homebrew content support
- custom conditions, effects, and temporary toggles
- stronger export, sharing, and layout control

## Current State In This Codebase

The current GM console already has a useful base:

- campaign-level numeric rules in `src/lib/campaign-metadata.ts`
- a settings API in `src/app/api/campaigns/[id]/settings/route.ts`
- a simple sheet settings form in `src/app/campaigns/[id]/settings/CharacterSheetCustomization.tsx`
- campaign homebrew collections for domain cards, weapons, and armor
- sheet rendering in `src/components/characters/character-sheet.tsx`
- character storage and defaults in `src/lib/characters.ts`

The current limits are the main reason this expansion is needed:

- resource tracks are effectively fixed to HP, Stress, Hope, and Experience
- currency is hard-coded to `gold`, `handfuls`, `bags`, and `debt`
- display toggles only cover gold, inventory, and connections
- terminology is mostly fixed in the sheet and builder
- homebrew collections do not yet cover classes, subclasses, ancestries, communities, items, conditions, or skills
- PDF export mirrors the same hard-coded assumptions
- custom fields exist conceptually but are not yet a real first-class GM-managed system across builder, sheet, editor, and export

## Proposed Build Updates

### 1. Resource Rules Console

Add a dedicated GM module for defining every tracked character resource.

GM options should include:

- rename any built-in resource label
- set default current and default max values
- set min and max bounds
- choose whether the resource is visible on builder, sheet, editor, PDF, and shared page
- choose whether the resource is player-editable
- choose whether the resource uses `current/max`, checkbox slots, or single-value format
- support permanent slot loss or gain for scars, boons, and homebrew features
- support temporary modifiers that can be toggled on and off

Community requests covered here:

- editable max Hope
- custom pools similar to spell points, rage, ammo, charges, progress tracks, and class-specific mechanics
- custom stress-like or fear-like tracks

### 2. Currency Rules Console

Replace the current fixed currency display with a configurable currency model.

GM options should include:

- currency mode: abstract, coin-based, or hybrid
- denomination list with custom labels and abbreviations
- default visible denominations
- exchange rate between denominations
- sort order
- whether debt exists and how it is labeled
- whether fractions and auto-conversion are allowed
- whether the sheet shows totals, breakdowns, or both

Community requests covered here:

- coins instead of handfuls
- renamed money fields for custom settings
- exact denomination tracking instead of abstract wealth only

### 3. Labels And Terminology Console

Add a label override layer so the GM can rename major UI and sheet concepts per campaign.

GM options should include:

- rename currencies
- rename Hope, Stress, Experience, and other resource labels
- rename domain card sections and card field labels
- rename sheet section headers such as `Connections`, `Inventory`, and `Background Questions`
- add custom helper text and rule reminders for players

Community requests covered here:

- custom card and DC naming
- setting-specific language without forking the UI

### 4. Sheet Layout And Visibility Console

Turn display settings into a full layout system instead of a few booleans.

GM options should include:

- show or hide any section
- reorder sections on the sheet
- choose compact, standard, or print-friendly layouts
- define section descriptions and helper notes
- decide which sections appear on share links and PDF exports
- choose whether empty sections collapse automatically
- choose whether hover details are always expanded on touch devices

Community requests covered here:

- better mobile readability
- print-friendly sheets
- less clutter for custom campaigns

### 5. Traits, Skills, And Check Rules Console

Support tables that want to alter check language or add custom roll surfaces.

GM options should include:

- add custom skills or disciplines
- rename skills and traits
- map a skill to one or more traits
- define campaign-specific roll labels and helper text
- add passive stats or derived fields
- create formula-backed display-only values later if needed

Community requests covered here:

- custom skills
- alternative attribute mappings
- extra sheet-facing stats that do not exist in the default rules

### 6. Character Creation Rules Console

Expand the existing rules panel into a full campaign builder policy layer.

GM options should include:

- base and max defaults for all built-in resources
- level-based progression tables
- domain deck size rules
- starting equipment packages by class or by campaign background
- custom mandatory fields during character creation
- optional field groups for backgrounds, bonds, faction ties, oaths, or campaign-specific lore
- class, subclass, ancestry, and community allowlists
- defaults and lock states for selected rules

Community requests covered here:

- campaign-specific creation constraints
- required custom questions and sheet fields
- custom domain and equipment defaults

### 7. Full Homebrew Content Library

Expand campaign homebrew beyond domain cards, weapons, and armor.

GM-managed homebrew collections should include:

- classes
- subclasses
- ancestries
- communities
- domain cards
- weapons
- armor
- items
- consumables
- conditions
- custom skills
- custom resource templates

Each collection should support:

- create, edit, duplicate, archive
- campaign-only or reusable library scope
- official-plus-homebrew filtering in player flows
- notes, tags, and version metadata

Community requests covered here:

- full homebrew support rather than partial card or gear support only

### 8. Conditions And Temporary Effects Console

Add a GM-defined condition and effect system.

GM options should include:

- define named conditions
- define sheet-visible effect badges
- set effect descriptions and reminders
- attach temporary or permanent modifiers to resources
- control whether players can self-toggle the condition
- mark effects as private to the GM or visible to players

Community requests covered here:

- custom conditions
- toggleable temporary effects instead of note-only tracking

### 9. Export, Share, And Import Controls

Make campaign customization flow through every output surface.

Required updates:

- apply campaign labels, currencies, and resources to shared sheets
- apply the same rules to PDF export
- export character JSON with campaign-aware metadata
- import campaign settings bundles so GMs can reuse a ruleset across campaigns
- support copy-from-campaign for fast setup

Community requests covered here:

- portability
- reuse across tables
- less manual re-entry for heavy homebrew groups

## GM Console Information Architecture

The current three-tab console should expand into a modular control center.

Recommended tabs:

1. Overview
2. Resources
3. Currency
4. Labels
5. Layout
6. Traits And Skills
7. Character Rules
8. Homebrew Library
9. Conditions And Effects
10. Export And Sharing

Each tab should expose player impact clearly:

- `Builder`: affects creation flow
- `Sheet`: affects live character sheet
- `Editor`: affects post-creation editing
- `Export`: affects PDF and JSON output
- `Share`: affects public character links

## Target Data Model Changes

The project is already storing rich campaign and character metadata in text columns. This should continue, but the metadata shape needs to widen.

Recommended `CharacterSheetCustomization` additions:

```ts
type CharacterSheetCustomization = {
  resources: ResourceDefinition[];
  currency: CurrencyConfiguration;
  labels: LabelOverrides;
  layout: LayoutConfiguration;
  skills: SkillDefinition[];
  characterRules: CharacterRuleConfiguration;
  displaySettings: DisplaySettings;
  domainCardTemplate: DomainCardTemplate | null;
  importExport: ImportExportConfiguration;
};
```

Recommended `CampaignHomebrewCollections` additions:

```ts
type CampaignHomebrewCollections = {
  classes: HomebrewClassDefinition[];
  subclasses: HomebrewSubclassDefinition[];
  ancestries: HomebrewAncestryDefinition[];
  communities: HomebrewCommunityDefinition[];
  domainCards: DomainCardDefinition[];
  weapons: WeaponDefinition[];
  armor: ArmorDefinition[];
  items: HomebrewItemDefinition[];
  conditions: ConditionDefinition[];
  skills: SkillDefinition[];
  resourceTemplates: ResourceDefinition[];
};
```

Recommended character metadata additions:

```ts
type StoredCharacterMetadata = {
  resources: Record<string, { current: number | null; max: number | null }>;
  currencies: Record<string, number>;
  customFieldValues: Record<string, unknown>;
  activeConditions: string[];
  activeEffects: string[];
  derivedStats: Record<string, number | string>;
};
```

## Code Touchpoints

Primary files that will need expansion:

- `src/lib/campaign-metadata.ts`
- `src/lib/characters.ts`
- `src/app/api/campaigns/[id]/settings/route.ts`
- `src/app/campaigns/[id]/settings/page.tsx`
- `src/app/campaigns/[id]/settings/CharacterSheetCustomization.tsx`
- `src/components/characters/character-sheet.tsx`
- `src/components/characters/character-editor.tsx`
- `src/app/characters/create/hooks/useCharacterWizard.ts`
- `src/app/characters/create/steps/*`
- `src/lib/pdf/characterSheet.ts`

New APIs will likely be needed for the expanded homebrew collections:

- `/api/classes`
- `/api/subclasses`
- `/api/ancestries`
- `/api/communities`
- `/api/items`
- `/api/conditions`
- `/api/skills`
- `/api/resource-templates`

## Suggested Delivery Plan

Everything requested should be in scope, but the order matters because the current code has several hard-coded assumptions. The cleanest rollout is:

### Phase 1. Settings Foundation

- widen campaign metadata and validation schemas
- introduce generic resource and currency configs
- add label and layout config primitives
- make existing sheet and editor render from config instead of fixed labels

### Phase 2. Player Surface Adoption

- apply config to builder, editor, share page, and PDF export
- replace hard-coded currency block
- replace fixed resource cards with config-driven rendering
- make custom fields real across all character surfaces

### Phase 3. GM Console Expansion

- split the current sheet tab into focused modules
- add form UIs for resources, currencies, labels, layout, and skills
- add import and copy-from-campaign helpers

### Phase 4. Homebrew Library Expansion

- add campaign-managed classes, subclasses, ancestries, communities, items, conditions, and skills
- thread those collections into builder selectors and sheet rendering

### Phase 5. Effects And Rules Depth

- add active condition tracking
- add toggleable temporary effects
- add lock states, GM-only visibility, and richer derived-rule helpers

## Definition Of Done

This proposal is complete when a GM can do all of the following without editing code:

- change Hope caps and other resource caps
- replace handfuls with coins or any custom denomination system
- rename major labels across the builder, sheet, share page, and PDF
- add custom fields and custom resources that persist with characters
- change creation rules and deck limits for a specific campaign
- add and manage campaign homebrew beyond cards, weapons, and armor
- define custom conditions and effect toggles
- export and share characters with the campaign's custom language and rules intact

## Recommendation

Treat this as the next major build track for the project.

The foundation is already present, but the project should move from `a few campaign tweaks` to `a real campaign rules engine for sheet behavior`.

That shift will let the GM console cover the strongest recurring community requests without forcing custom tables back into notes fields or out-of-band house-rule documents.
