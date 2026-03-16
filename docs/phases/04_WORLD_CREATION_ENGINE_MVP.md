# 04 World Creation Engine MVP

## Objective
Move creator workflows to dashboard-first tooling usable by all authenticated users, independent of campaign ownership.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- `03_CONTENT_PLATFORM_FOUNDATION.md` shipped.

## Fixed Decisions Inherited
- Personal drafts are private until installed/published.
- `Save to campaign` uses hidden one-item product/version install parity.
- Paid products remain non-live before phase `07`.

## User-Facing Outcomes
- New creator hub under dashboard world routes.
- Non-GM users can create personal content and package it into product drafts.
- Product draft/publish state visible in creator tooling.

## Routes, Components, Services, Files
- Add:
  - `src/app/(dashboard)/dashboard/world/page.tsx`
  - `src/app/(dashboard)/dashboard/world/[kind]/page.tsx`
  - `src/app/(dashboard)/dashboard/world/bundles/page.tsx`
  - `src/app/(dashboard)/dashboard/world/bundles/[id]/page.tsx`
  - `src/components/world/*`
- Repurpose:
  - `src/app/(dashboard)/dashboard/library/page.tsx`
- Integrate existing tools:
  - adversary authoring
  - personal equipment libraries

## Data/API/Interface Changes
- Use `content/*` and `products/*` APIs from phase `03`.
- Support mandatory kinds in MVP:
  - adversaries
  - equipment
  - classes
  - subclasses
  - ancestries
  - communities
  - skills
  - conditions
  - resource templates

## Permissions And Roles
- Any authenticated user may create personal drafts.
- Publishing rights follow product visibility rules.
- Campaign writes are not performed directly from editor state.

## Acceptance Tests
- User can create/edit/delete personal drafts in each mandatory kind.
- User can build a product draft containing mixed content kinds.
- User can mark draft as listed/unlisted according to access policy.
- Existing campaign pages remain functional.
- Build/test/lint/typecheck pass.

## Exit Gate
- WCE is usable as primary creator surface for core non-card content.

## Non-Goals
- Campaign install manager UI.
- Community moderation queue.
- Paid checkout.
- Card studio.

## Rollback
- Trigger:
  - WCE regressions block existing authoring capabilities
- Action:
  - route users back to prior dashboard/library authoring paths
  - keep new content APIs in place but hide unstable WCE routes
- Data Impact:
  - personal drafts remain persisted; no destructive cleanup required
