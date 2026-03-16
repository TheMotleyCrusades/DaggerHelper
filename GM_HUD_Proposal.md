# GM HUD Proposal

Updated: 2026-03-14
Workspace: `C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next`

## Goal

Add a campaign-linked GM HUD that is built for active play, not setup. The HUD should let the GM monitor the whole table in one place, make fast live edits, track player and adversary state, import encounters, search adversaries on the fly, and push live updates to player character sheets.

This is meant to become the in-session command center for:

- player state tracking
- adversary state tracking
- live encounter management
- quick stat block reference
- temporary conditions and toggles
- campaign-specific custom resources from the sheet system

## Working Assumptions

These assumptions keep the proposal concrete without blocking on design debates:

- the HUD is campaign-scoped
- the GM has full write access
- players keep their own character sheet route and receive live updates there
- the HUD respects campaign sheet customization, including custom resources such as ammo
- the current encounter builder remains the prep tool, while the HUD becomes the live play tool

## Product Outcome

The GM should be able to open a campaign, launch a HUD, pull in an encounter, see all player characters and adversaries at once, and run the scene without jumping between multiple pages.

The HUD should answer these questions instantly:

- who is low on HP, Stress, Hope, or other tracked resources
- which conditions are active on each player or adversary
- which adversaries are currently in the scene
- what each adversary's simple live state is
- what the full stat block says without leaving the HUD
- whether a player's own sheet is reflecting the latest values

## Recommended Route And Entry Points

Primary route:

- `/campaigns/[id]/hud`

Recommended launch points:

- campaign details page
- encounter detail page
- GM customization console

Recommended optional query params:

- `?encounterId=123`
- `?view=compact`

## Core HUD Layout

The HUD should be a three-zone screen:

### 1. Player Rail

A live roster of all characters in the campaign.

Each player card should show:

- character name
- class and level
- HP
- Stress
- Hope
- Experience if tracked
- any GM-pinned custom resources such as ammo, spell points, rage, corruption, or debt
- active conditions
- quick buttons for `+1`, `-1`, direct edit, reset-to-max where appropriate
- shortcut to open the full player sheet

Each player card should support:

- inline live editing
- condition toggle buttons
- collapse or expand
- pinned notes visible only to the GM

### 2. Live Encounter Lane

A list of all adversaries currently in the live scene.

Each adversary entry should support:

- importing from a saved encounter
- adding new adversaries from search without leaving the HUD
- separate instance tracking when quantity is greater than one
- editable live values such as HP, Stress, phase, or custom condition states
- quick remove, defeat, hide, or mark as escaped

Simple adversary card contents:

- name
- tier
- type
- current live HP
- current live Stress
- difficulty
- active conditions
- GM quick actions

Full stat block behavior:

- mouseover on desktop reveals the full stat block
- click or tap opens a pinned drawer on mobile and touch devices
- the full block should reuse the current adversary stat block presentation where practical

### 3. Inspector And Utility Panel

A right-side panel for focused actions.

This panel should handle:

- full stat block view
- selected player quick-edit controls
- encounter controls
- campaign notes for the current scene
- session status and connection state
- optional filters such as `players only`, `adversaries only`, `conditions`, or `downed`

## Player Tracking Requirements

The HUD should not hard-code only HP and Stress. It should render from campaign sheet settings and show GM-selected live fields.

Baseline tracked fields:

- HP
- Stress
- Hope
- Experience
- gold or campaign currency
- debt if enabled

Config-driven tracked fields:

- ammo
- charges
- spell points
- rage-like resources
- corruption
- faction clocks
- custom numeric or checkbox resources added through the sheet customization system

HUD rules for player fields:

- the GM can choose which fields appear in the HUD
- each field can be `visible`, `editable`, `read-only`, or `hidden`
- fields can be displayed as `current/max`, `single value`, `slots`, or `toggle`
- player sheets should reflect GM changes in near real time

## Adversary Tracking Requirements

The HUD should treat adversaries as live encounter instances, not just references to saved stat blocks.

Each live adversary instance should support:

- source reference to the base adversary
- instance name such as `Bandit 1`, `Bandit 2`
- current HP and Stress
- active conditions
- GM-only notes
- visibility state such as `active`, `hidden`, `escaped`, `defeated`
- group or wave membership

This avoids mutating the saved adversary definition while still letting the GM run live state during play.

## Encounter Import And Live Encounter Control

The HUD should integrate directly with the existing encounter builder and encounter APIs.

Required encounter actions:

- import a saved encounter into the live HUD
- replace current live encounter
- merge an encounter into the current live scene
- add reinforcements later
- clear all adversaries from the live scene
- save the current live scene as a snapshot

Imported encounter behavior:

- encounter quantities should expand into individual live entries
- each entry should preserve a link back to the source adversary definition
- the HUD should show the encounter name and difficulty summary

## Adversary Search And Quick Add

The HUD should include a live search that returns adversaries across:

- campaign adversaries
- the GM's own adversaries
- optional public adversaries if allowed by permissions and filters

Search result behavior:

- fast type-to-filter search
- results show a simple summary immediately
- mouseover reveals the full stat block
- enter or click adds the adversary to the live encounter

This search should feel faster than leaving the HUD to browse the adversary library.

## Conditions And Toggle Buttons

Conditions must be first-class controls, not note fields.

Both player and adversary entries should support:

- campaign-defined condition buttons
- built-in conditions if the campaign wants them
- one-click toggle on and off
- optional stack counts or severity levels later
- visible reminder text in the inspector

Examples:

- vulnerable
- hidden
- bleeding
- frightened
- stunned
- marked
- custom campaign conditions

The HUD should also support quick temporary effect toggles such as:

- armor buff active
- shield broken
- temporary HP
- advantage-like status reminders

## Live Sync Model

Because this tool is for active play, the update loop matters.

Recommended sync model:

- use Supabase Realtime for campaign HUD state
- fall back to explicit refresh or short polling if realtime is unavailable
- keep optimistic local updates for fast button presses

Sync behavior:

- GM edits update the HUD immediately
- player sheets subscribed to the same campaign state update their visible fields
- only the GM HUD shows GM-only notes, adversary private notes, or hidden encounter state

## Permissions

Recommended permission model:

- GM can edit all live player and adversary runtime state
- players can view their own live-updated sheet
- players cannot edit adversary state
- player self-edit permissions for selected fields can be added later if the campaign allows it
- campaign members can have read-only HUD access later, but that is not required for the first build

## Data Model Proposal

This should use separate runtime state instead of overloading saved encounter rows or static adversary definitions.

Recommended runtime entities:

```ts
type CampaignHudSettings = {
  enabledFields: string[];
  pinnedPlayerFields: string[];
  pinnedAdversaryFields: string[];
  defaultEncounterView: "split" | "players" | "adversaries";
  allowPublicAdversarySearch: boolean;
};

type LiveEncounterState = {
  campaignId: number;
  sourceEncounterId: number | null;
  name: string | null;
  status: "idle" | "active" | "paused" | "complete";
  adversaries: LiveAdversaryInstance[];
  updatedAt: string;
};

type LiveAdversaryInstance = {
  id: string;
  adversaryId: number;
  displayName: string;
  hpCurrent: number | null;
  stressCurrent: number | null;
  conditions: string[];
  gmNotes: string | null;
  visibility: "active" | "hidden" | "escaped" | "defeated";
};

type CharacterRuntimeOverlay = {
  characterId: number;
  trackedFields: Record<string, number | boolean | string | null>;
  conditions: string[];
  gmNotes: string | null;
};
```

Key principle:

- static character data stays in the character record
- static adversary data stays in the adversary definition
- live session state lives in dedicated HUD runtime records

## API Proposal

Recommended additions:

- `GET /api/campaigns/[id]/hud`
- `PUT /api/campaigns/[id]/hud`
- `POST /api/campaigns/[id]/hud/import-encounter`
- `POST /api/campaigns/[id]/hud/adversaries`
- `PATCH /api/campaigns/[id]/hud/adversaries/[instanceId]`
- `DELETE /api/campaigns/[id]/hud/adversaries/[instanceId]`
- `PATCH /api/campaigns/[id]/hud/characters/[characterId]`
- `GET /api/campaigns/[id]/hud/search-adversaries?q=...`

These should be built on top of the existing access checks already used by:

- campaigns
- encounters
- adversaries
- characters

## Existing Code Touchpoints

The HUD proposal should be designed around the current app instead of duplicating existing work.

Current files and systems to reuse:

- `src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`
- `src/app/api/campaigns/[id]/route.ts`
- `src/app/api/characters/route.ts`
- `src/app/api/characters/[id]/route.ts`
- `src/app/api/encounters/route.ts`
- `src/app/api/encounters/[id]/route.ts`
- `src/app/api/adversaries/route.ts`
- `src/lib/characters.ts`
- `src/lib/encounters.ts`
- `src/lib/adversaries.ts`
- `src/components/characters/character-sheet.tsx`
- `src/components/adversaries/adversary-stat-block.tsx`
- `src/components/encounters/encounter-builder.tsx`

Planned new surfaces:

- `src/app/campaigns/[id]/hud/page.tsx`
- `src/components/hud/*`
- `src/app/api/campaigns/[id]/hud/*`

## UX Requirements

This screen is for active play, so speed matters more than decorative density.

The HUD should optimize for:

- one-screen visibility of the whole scene
- fast button targets
- no route changes for common actions
- desktop hover support
- mobile tap fallbacks for hover-only interactions
- high contrast and easy scanning
- clear separation between player state and adversary state

Good quick actions:

- `-1 HP`
- `+1 Stress`
- `toggle hidden`
- `mark defeated`
- `open full sheet`
- `open stat block`

## Relationship To Player Sheets

Player characters should keep their normal sheet route and remain the personal view for each player.

Expected behavior:

- the player sheet shows the character's current live values
- the GM can update those values from the HUD
- players do not need to be on the HUD to see the newest numbers
- campaign sheet customization still controls how the player's sheet renders

## Suggested Delivery Plan

### Phase 1. HUD Foundation

- add HUD route and campaign launch entry point
- define runtime state entities
- add GM-only HUD access checks
- load campaign characters and source encounter data

### Phase 2. Player Live Tracking

- show player cards
- support HP, Stress, Hope, and config-driven custom resources
- add direct edits and condition toggles
- push updates to player sheets

### Phase 3. Adversary Live Tracking

- import saved encounters
- spawn live adversary instances
- add simple cards plus hover-to-reveal full stat blocks
- add quick add through search

### Phase 4. Realtime Sync And Polish

- add realtime subscriptions
- add optimistic updates
- add session status, reconnect handling, and mobile drawer behavior

### Phase 5. Snapshot And Session Features

- save and restore live encounter snapshots
- add reinforcement presets
- add optional read-only spectator view later if needed

## Definition Of Done

This proposal is complete when a GM can:

- open a campaign HUD and see all player characters immediately
- live-edit HP, Stress, Hope, and campaign-configured custom resources
- toggle conditions on players and adversaries
- import an encounter from the encounter builder
- search adversaries and add them to the live scene without leaving the HUD
- view a simple adversary block at a glance and reveal the full stat block on hover or tap
- trust that player sheets update to reflect live GM changes

## Recommendation

Treat the GM HUD as the natural second half of the sheet customization work.

The sheet customization system defines what can be tracked.
The HUD makes that tracking useful during play.

Together they turn the project from a prep toolkit into a real table-running tool.
