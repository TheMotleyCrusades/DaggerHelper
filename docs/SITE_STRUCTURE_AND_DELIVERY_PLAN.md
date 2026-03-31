# Site Structure And Delivery Plan

## Why This Exists
This document is the working source of truth for:
- navigation ownership
- page purpose and scope
- current implementation status
- what is still placeholder/scaffold
- what gets built next, in what order

Use this before adding new routes or major UI sections.

## Core Product Intent
Dagger Helper is a creator-to-table platform:
- creators build world content and tools
- GMs install/configure content into campaigns
- players create/use character sheets in live play
- community sharing/discovery reuses the same content model

## Navigation Architecture (Single Owner Per Layer)

### Layer 1: Global Nav (always visible except auth/landing)
Owner: `src/components/layout/global-top-nav.tsx`

Allowed links:
- `Home` -> `/`
- `Dashboard` -> `/dashboard`
- `Community Library` -> `/community`

Rules:
- No workflow tabs here.
- Only cross-product movement.
- Route-specific quick actions are allowed only when they replace page-local duplicate actions.

### Layer 2: Workspace Nav (dashboard-only)
Owner: `src/app/(dashboard)/dashboard/layout.tsx`

Allowed tabs:
- `Overview` -> `/dashboard`
- `Campaigns` -> `/dashboard/campaigns`
- `World Creator Engine` -> `/dashboard/world`
- `Characters` -> `/dashboard/characters`
- `Encounters` -> `/dashboard/encounters`
- `Settings` -> `/dashboard/settings`
- `Moderation` (role-gated) -> `/dashboard/moderation`

Rules:
- This is the only primary navigation inside dashboard.
- Individual pages should not re-create another primary tab row.

### Layer 3: Local Section Nav (inside a feature only)
Owner: each feature surface

Examples:
- campaign tabs within a campaign
- world creator kind tabs within world creator
- character wizard step controls

Rules:
- Must only navigate within the local feature.
- Must not duplicate Layer 1 or Layer 2 destinations.

## Canonical Section Specs

### 1) Home (`/`)
Purpose:
- public entry point with leaderboard/community highlights
- sign in/register paths

Must contain:
- clear value proposition
- top community highlights
- CTA to dashboard for signed-in users

Current state:
- `PARTIAL` (functional, but mostly marketing + summary)

### 2) Dashboard Overview (`/dashboard`)
Purpose:
- operational command center for authenticated users

Must contain:
- resume work
- content/campaign stats
- creator score
- actionable shortcuts to active work

Current state:
- `GOOD` (functional summary widgets)

### 3) World Creator Engine (`/dashboard/world*`)
Purpose:
- canonical authoring surface for all build workflows

Must contain:
- clear lanes:
  - `Libraries` (structured content CRUD)
  - `Builders` (guided workflows like adversary builder)
  - `Bundles` (packaging/versioning/distribution)
- no duplicate "library-like" tools outside this section unless they redirect here

Current state:
- `PARTIAL`
- engine home exists
- dynamic kind pages exist
- bundle manager/editor exists
- many kinds use generic `WorldKindManager` scaffold (works, but not domain-rich)

### 4) Campaign Workspace (`/dashboard/campaigns/[id]`, `/campaigns/[id]/hud`, `/campaigns/[id]/settings`)
Purpose:
- run and configure a specific campaign

Must contain:
- campaign summary
- members/invite flow
- content installs/suggestions
- GM HUD for live sessions
- settings/customization controls

Current state:
- `PARTIAL TO GOOD`
- HUD exists and is functional
- settings expansion is in progress
- content manager exists

### 5) Character System (`/characters*`, `/dashboard/characters*`)
Purpose:
- create/edit/play/share characters aligned to campaign rules

Must contain:
- guided builder flow
- sheet runtime interactions (resources/conditions/cards/equipment)
- exports (JSON/PDF/share)

Current state:
- `PARTIAL`
- major systems are present
- still needs rules-accuracy polish and UX consistency pass

### 6) Encounters (`/dashboard/encounters*`)
Purpose:
- build and maintain encounter definitions reusable in campaigns/HUD

Must contain:
- encounter CRUD
- adversary assignment
- import into HUD

Current state:
- `PARTIAL`

### 7) Community Library (`/community*`, `/adversaries/[id]`, `/share/[shareId]`)
Purpose:
- browse, preview, claim/install, and share content

Must contain:
- search/filter
- detail pages
- install/claim pathways (role and entitlement aware)

Current state:
- `PARTIAL TO GOOD`

### 8) Commerce/Publishing (`/dashboard/world/bundles*`, `/api/products*`)
Purpose:
- package and publish creator products

Must contain:
- product/version workflow
- entitlement and claim/install
- payment integration when enabled

Current state:
- `PARTIAL`
- free-flow mostly scaffolded
- paid flow blocked by Stripe setup decisions

## Current Route Duplication / Confusion Points

1. `World Creator Engine` vs `Library` overlap:
- `/dashboard/library` and `/dashboard/world/weapons|armor|items|consumables` overlap in intent.

2. Builder location mismatch:
- guided adversary builder lives under `/dashboard/adversaries/new` while world engine is meant to be canonical builder hub.

3. Mixed nav ownership:
- global quick actions + workspace tabs + page-local link clusters occasionally overlap in destination.

## Consolidation Decisions (Proposed)

1. World Creator Engine is canonical for all authoring.
- Keep `/dashboard/adversaries*` for now as compatibility surface.
- Add explicit redirects and labels toward world creator equivalents where appropriate.

2. Keep only one dashboard primary tab row.
- no second "section tabs" directly under page titles unless it is truly local navigation.

3. De-duplicate route families by intent:
- Authoring: `/dashboard/world/*`
- Campaign operation: `/dashboard/campaigns/*` + `/campaigns/[id]/*`
- Character runtime: `/characters/*`
- Discovery/community: `/community/*`

## Placeholder / Scaffold Audit

### High-confidence scaffolds
- `WorldKindManager` generic CRUD for classes/subclasses/ancestries/communities/skills/conditions/resource templates.
- `WorldProductManager` and some bundle flows use generic forms with limited domain guidance.

### Mature surfaces
- Dashboard summary
- Adversary guided builder
- Campaign HUD baseline
- Equipment catalog resolver + APIs

### Needs explicit spec before deep build
- World creator content kind pages (domain-specific UX, not generic text CRUD)
- character leveling/rules-accuracy and class-specific guidance
- final PDF styling parity target

## Delivery Plan (Execution Order)

### Phase A: Navigation Governance
- enforce the 3-layer nav model
- remove duplicate page-local primary nav
- align labels and route ownership
- add redirect map for legacy/duplicate paths

### Phase B: World Creator Engine Information Architecture
- define sub-sections:
  - Libraries
  - Builders
  - Bundles
- map each existing route to one of these
- document which pages are compatibility-only vs canonical

### Phase C: Section-by-Section Build Specs
- for each canonical section, define:
  - target user
  - core jobs to be done
  - required data and APIs
  - minimum complete UI state
  - done criteria

### Phase D: Placeholder Burn-down
- replace generic/scaffold interfaces with guided domain UIs
- track each page with status: `Scaffold`, `Partial`, `Production-ready`

## Change Control Rules

Before adding a route/page:
- define which nav layer owns access
- define section and job-to-be-done
- add status row in this document
- avoid creating a second route for the same intent unless redirect compatibility is required

## Decision Questions (Needs Product Direction)

1. Should `Moderation` be hidden for non-admin roles entirely (recommended)?
2. Should `/dashboard/library` become a redirect to `/dashboard/world/weapons` (recommended)?
3. Should `/dashboard/adversaries` remain as a management index but label itself as part of World Creator Engine (recommended)?
4. Should world creator kinds be regrouped visually into `Libraries`, `Character Rules`, and `Runtime Systems` rather than one long flat list (recommended)?
5. Do you want campaign-level quick links (`HUD`, `Settings`) to remain in global quick actions, or move fully inside campaign pages?

## Immediate Next Artifact
After decisions above, produce:
- `docs/SECTION_BUILD_SPECS.md` with one spec block per canonical section, including detailed feature checklist and "left to do" status.
