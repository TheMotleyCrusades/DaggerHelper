# 02 Navigation And Dashboard

## Objective
Make the global header the primary navigation model and turn `/dashboard` into the true operational home for authenticated users.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- Current build/test pipeline is green.
- Existing dashboard/auth routes are functional.

## Fixed Decisions Inherited
- Product/version and entitlement policy from `01` applies to all dashboard/catalog display wording.
- Paid product surfaces remain non-purchasable before phase `07`.

## User-Facing Outcomes
- Global header is visible on dashboard routes.
- Dashboard-local header/sidebar duplication is removed.
- Dashboard home shows:
  - resume work
  - recent community interaction
  - creator score
  - owned products summary
  - created-content totals
- Redundant local navigation is removed from dashboard/community/campaign pages where global nav already covers primary movement.

## Routes, Components, Services, Files
- Edit:
  - `src/components/layout/global-top-nav.tsx`
  - `src/app/(dashboard)/dashboard/layout.tsx`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/app/community/page.tsx`
  - `src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`
- Add:
  - `src/app/api/dashboard/summary/route.ts`
  - `src/lib/dashboard-summary.ts`

## Data/API/Interface Changes
- Add `GET /api/dashboard/summary` returning dashboard widget payload:
  - counts and totals
  - creator score summary
  - resume work links
  - recent community leaderboard block
  - owned-product placeholder counts

## Permissions And Roles
- Dashboard summary route requires authenticated user.
- Summary is scoped to current user for personal/campaign stats.
- Community leaderboard section can include globally visible aggregate data.

## Acceptance Tests
- Global header renders on `/dashboard*` routes.
- Dashboard shell no longer duplicates logout/back-home header model.
- Dashboard home loads summary data and renders widgets without runtime errors.
- Community page no longer depends on redundant local primary navigation.
- Campaign detail page avoids duplicate back-navigation controls where global quick actions exist.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test -- --run`, and `pnpm build` pass.

## Exit Gate
- Navigation model is stable and usable without touching content-platform schema migration.
- Dashboard can be used as starting point for phase `04` WCE rollout.

## Non-Goals
- No content-platform schema migration.
- No catalog/product installation flow.
- No Stripe or commerce behavior.

## Rollback
- Trigger:
  - global nav regression blocks key user journeys
  - dashboard summary route causes auth/runtime instability
- Action:
  - revert nav visibility changes and dashboard summary route
  - restore prior dashboard layout shell
- Data Impact:
  - none (UI/API-only additions in this phase)
