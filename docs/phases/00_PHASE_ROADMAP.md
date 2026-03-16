# 00 Phase Roadmap

## Objective
Provide the single execution index for the World Creation Engine + content platform overhaul, with dependency order, ship gates, and rollback-safe sequencing.

## Status Tracker
- `00_PHASE_ROADMAP.md`: `ACTIVE`
- `01_FOUNDATION_POLICIES.md`: `ACTIVE`
- `02_NAVIGATION_AND_DASHBOARD.md`: `COMPLETE`
- `03_CONTENT_PLATFORM_FOUNDATION.md`: `COMPLETE`
- `04_WORLD_CREATION_ENGINE_MVP.md`: `COMPLETE`
- `05_CAMPAIGN_CONTENT_MANAGER_AND_INSTALLS.md`: `COMPLETE`
- `06_COMMUNITY_CATALOG_AND_MODERATION.md`: `COMPLETE`
- `07_STRIPE_COMMERCE_AND_ENTITLEMENTS.md`: `BLOCKED (missing Stripe env + webhook config)`
- `08_CARD_STUDIO_AND_CARD_PRODUCTS.md`: `PLANNED`
- `09_LEGACY_CONSOLE_CLEANUP.md`: `PLANNED`

## Release Order
1. `01_FOUNDATION_POLICIES.md`
2. `02_NAVIGATION_AND_DASHBOARD.md`
3. `03_CONTENT_PLATFORM_FOUNDATION.md`
4. `04_WORLD_CREATION_ENGINE_MVP.md`
5. `05_CAMPAIGN_CONTENT_MANAGER_AND_INSTALLS.md`
6. `06_COMMUNITY_CATALOG_AND_MODERATION.md`
7. `07_STRIPE_COMMERCE_AND_ENTITLEMENTS.md`
8. `08_CARD_STUDIO_AND_CARD_PRODUCTS.md`
9. `09_LEGACY_CONSOLE_CLEANUP.md`

## Dependency Graph
- `01` is required by all later phases.
- `02` can ship independently after `01`.
- `03` is required before `04`, `05`, `06`, `07`, and `08`.
- `04` is required before `05` (WCE content source exists first).
- `05` is required before `09` (legacy authoring can only be removed after install flow exists).
- `06` is required before broad marketplace launch behavior.
- `07` is required before any paid product listing is allowed.
- `08` depends on `03` and uses shared product/install model.

## Independent Ship Units
- `02` ships as UX/navigation cleanup only.
- `03` ships as backend/data/API foundation only.
- `04` ships with personal creator tooling and free/pending publication capabilities.
- `05` ships campaign install/remove flow with warnings and archives.
- `06` ships public catalog/moderation for free and teaser experiences.
- `07` ships paid commerce and entitlement fulfillment.
- `08` ships card studio + card product packaging.
- `09` ships legacy console cleanup after parity confirmation.

## Phase Exit Gates
- Every phase requires:
  - `pnpm exec tsc --noEmit`
  - `pnpm lint`
  - `pnpm test -- --run`
  - `pnpm build`
- Every phase doc must include:
  - entry criteria
  - explicit non-goals
  - acceptance tests
  - rollback trigger + rollback action + data impact note

## Rollback Safety Rules
- No destructive migration is allowed in the same release where it is introduced.
- New stores/routes must support adapter-based fallback until the cleanup phase.
- If a ship gate fails, freeze phase at previous green checkpoint and do not advance dependency chain.

## Notes
- Paid product publishing remains disabled until phase `07` is fully live.
- Existing adversary public URLs remain canonical during platform expansion.
- Current block (2026-03-16): Stripe keys/webhook secret are not configured in `.env.local`, so hosted checkout and entitlement webhook verification cannot be completed yet.
