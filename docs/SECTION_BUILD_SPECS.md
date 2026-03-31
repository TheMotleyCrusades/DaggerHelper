# Section Build Specs

## Scope
This document defines exactly what each section of the site is for, what must be in it, what is currently implemented, and what is left before each section is production-ready.

Status labels:
- `SCAFFOLD`: basic route/form exists, but not domain-ready.
- `PARTIAL`: core workflow exists, but still missing required depth.
- `PRODUCTION`: section is stable against agreed spec.

---

## 1) Home
Primary routes:
- `/`

Primary users:
- new visitors
- signed-out users
- returning users deciding where to go next

Purpose:
- explain product value quickly
- show social proof/community activity
- route users into Dashboard or Community

Must-have functionality:
- hero value proposition and CTA
- top liked/shared highlights
- clear sign-in/register state

Current status:
- `PARTIAL`

Remaining work:
- tighten copy to match final product scope
- standardize leaderboard data blocks with community section
- ensure no duplicate primary nav controls inside page body

Definition of done:
- page communicates core value in <10 seconds
- users can reach primary destinations without duplicate nav clusters

---

## 2) Global Navigation
Primary component:
- `src/components/layout/global-top-nav.tsx`

Purpose:
- cross-product movement only

Must-have functionality:
- only `Home`, `Dashboard`, `Community Library`
- auth controls
- no campaign quick actions

Current status:
- `PARTIAL` (still contains route quick actions)

Remaining work:
- remove campaign quick actions from global nav
- keep campaign quick links inside campaign pages only

Definition of done:
- global nav has only cross-product links and auth actions

---

## 3) Dashboard Workspace Shell
Primary component:
- `src/app/(dashboard)/dashboard/layout.tsx`

Purpose:
- one authoritative workspace tab model

Must-have functionality:
- tabs: `Overview`, `Campaigns`, `World Creator Engine`, `Characters`, `Encounters`, `Settings`
- `Moderation` only visible for admin users
- no duplicated second-level primary tabs on section pages

Current status:
- `PARTIAL`

Remaining work:
- role-gate `Moderation`
- audit section pages for duplicate "primary-like" nav rows and remove

Definition of done:
- dashboard routes have one clear primary tab model

---

## 4) Dashboard Overview
Primary route:
- `/dashboard`

Purpose:
- operational snapshot for active user

Must-have functionality:
- resume work
- campaign/content counts
- creator score
- community interaction summary

Current status:
- `PRODUCTION` (for current phase scope)

Remaining work:
- none critical for nav/spec phase

Definition of done:
- stable data load and fast route to active work

---

## 5) World Creator Engine (Canonical Authoring Surface)
Primary routes:
- `/dashboard/world`
- `/dashboard/world/[kind]`
- `/dashboard/world/bundles`
- `/dashboard/world/bundles/[id]`

Purpose:
- single canonical place to build and package content

Must-have functionality:
- engine home with clear quick actions
- kind-specific managers
- bundle/product manager and version editor
- explicit route ownership for all authoring workflows

Current status:
- `PARTIAL`

Remaining work:
- remove duplicate authoring entry routes:
  - `/dashboard/library`
  - `/dashboard/adversaries`
- move adversary management fully under world creator route family
- keep kind list flat (no additional menu complexity)
- replace generic `WorldKindManager` experiences with domain-specific UIs over time

Definition of done:
- all authoring starts in `/dashboard/world*`
- no duplicate alternate "authoring hub" routes

---

## 6) Campaigns (Management + In-Play)
Primary routes:
- `/dashboard/campaigns`
- `/dashboard/campaigns/new`
- `/dashboard/campaigns/[id]`
- `/dashboard/campaigns/[id]/content`
- `/campaigns/[id]/hud`
- `/campaigns/[id]/settings`

Purpose:
- campaign lifecycle management and in-session operation

Must-have functionality:
- campaign CRUD
- member/invite management
- content install/suggestion flow
- GM HUD live tracking
- rules/customization settings
- local campaign quick actions only inside campaign pages

Current status:
- `PARTIAL TO GOOD`

Remaining work:
- ensure campaign-local quick links are complete and consistent
- remove campaign quick links from global nav
- add explicit campaign sub-navigation pattern shared across campaign pages

Definition of done:
- all campaign tasks are reachable from campaign pages without global quick-action reliance

---

## 7) Characters
Primary routes:
- `/characters`
- `/characters/create`
- `/characters/[id]`
- `/characters/[id]/edit`
- `/dashboard/characters`

Purpose:
- create, run, and manage player characters

Must-have functionality:
- reliable wizard flow
- sheet interactions (resources, conditions, equipment, cards)
- export/share pathways

Current status:
- `PARTIAL`

Remaining work:
- continue rules-accuracy pass (leveling/options/spec alignment)
- finalize sheet UX consistency and PDF quality target
- reduce route overlap between `/dashboard/characters` and `/characters` if duplicate behaviors persist

Definition of done:
- full creation-to-play loop works without fallback/placeholder behaviors

---

## 8) Encounters
Primary routes:
- `/dashboard/encounters`
- `/dashboard/encounters/new`
- `/dashboard/encounters/[id]`

Purpose:
- prepare reusable encounter sets for campaign play

Must-have functionality:
- encounter CRUD
- adversary linking
- import path into campaign HUD

Current status:
- `PARTIAL`

Remaining work:
- verify full handoff into HUD workflows
- improve encounter authoring guidance and validation

Definition of done:
- GM can author encounter and run/import it into HUD with no manual workaround

---

## 9) Community Library
Primary routes:
- `/community`
- `/community/adversaries/[id]`
- `/community/products/[id]`
- `/share/[shareId]`
- `/adversaries/[id]`

Purpose:
- discovery, preview, and install/claim entry points

Must-have functionality:
- search/filter
- detail views
- install/claim/share consistency

Current status:
- `PARTIAL TO GOOD`

Remaining work:
- harmonize detail templates between adversary/product/share
- ensure install and entitlement messaging is consistent

Definition of done:
- users can discover and consume published content without ambiguity

---

## 10) Moderation
Primary route:
- `/dashboard/moderation`

Purpose:
- moderation queue and report management

Must-have functionality:
- role-restricted visibility
- queue triage actions

Current status:
- `PARTIAL`

Remaining work:
- enforce admin-only visibility at nav and route levels
- finalize moderation workflow states

Definition of done:
- non-admin users cannot access moderation surfaces

---

## 11) Commerce And Publishing
Primary routes:
- `/dashboard/world/bundles*`
- `/api/products*` (backing APIs)

Purpose:
- package and publish creator products

Must-have functionality:
- product/version lifecycle
- free listing flow
- paid flow once commerce gate is opened

Current status:
- `PARTIAL`

Remaining work:
- keep paid flow blocked until commerce phase
- finalize entitlement-aware messaging and install handoff

Definition of done:
- free flow stable now, paid flow activated only when Stripe phase is complete

---

## Route De-Duplication Targets
These are agreed removals/consolidations:
- `/dashboard/library` -> remove/redirect to `/dashboard/world/weapons`
- `/dashboard/adversaries*` -> consolidate into `/dashboard/world/*` authoring path
- campaign quick actions removed from global nav

---

## Implementation Order For This Spec
1. Navigation cleanup pass:
- global nav simplification
- moderation role-gating in dashboard tabs
- campaign quick-action relocation

2. Route consolidation pass:
- redirects/removals for duplicate authoring routes
- update internal links to canonical world creator routes

3. Section depth pass:
- replace high-value scaffolds with domain-rich editors
- keep list flat in world creator until existing flow is stable

4. Status tracking:
- mark each section `SCAFFOLD` -> `PARTIAL` -> `PRODUCTION` as criteria are met
