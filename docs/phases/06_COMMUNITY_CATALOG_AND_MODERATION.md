# 06 Community Catalog And Moderation

## Objective
Convert `/community` into a public catalog surface with free claims, teaser visibility for paid entries, and moderation/reporting operations.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- `03_CONTENT_PLATFORM_FOUNDATION.md` shipped.
- `05_CAMPAIGN_CONTENT_MANAGER_AND_INSTALLS.md` available.

## Fixed Decisions Inherited
- Entitled users retain access to delisted products.
- Paid products require entitlement for protected content.
- Existing adversary public detail URLs remain canonical.

## User-Facing Outcomes
- Public users can browse catalog listings without login.
- Authenticated users can claim free products.
- Paid products show teaser/sample content without exposing protected bodies.
- Users can report content.
- Moderators can review and action reports.

## Routes, Components, Services, Files
- Edit/Add:
  - `src/app/community/**/*`
  - `src/components/community/*`
  - moderation/report APIs
  - `src/lib/leaderboard.ts` and dashboard/community summary services

## Data/API/Interface Changes
- Catalog listing/detail endpoints with visibility filters.
- Claim endpoint for free entitlement creation.
- Report endpoints writing `content_reports`.
- Moderation queue endpoints writing `moderation_actions`.

## Permissions And Roles
- Signed-out: browse listing metadata and teaser data.
- Signed-in users: claim free products, submit reports.
- Moderators/admin: resolve reports and apply actions.

## Acceptance Tests
- Signed-out catalog browse works.
- Free claim creates entitlement record.
- Paid detail blocks protected content without entitlement.
- Delisted content remains accessible to entitled users.
- Report submission and moderation action pipeline works.
- Build/test/lint/typecheck pass.

## Exit Gate
- Community library and moderation workflows are live for free and teaser experiences.

## Non-Goals
- Stripe checkout and payout execution.
- Card studio authoring.

## Rollback
- Trigger:
  - moderation or entitlement checks produce incorrect public exposure
- Action:
  - revert catalog surfaces to conservative listing mode
  - keep report/moderation records preserved for later replay
- Data Impact:
  - claims/reports/actions persist; UI rollback only if needed
