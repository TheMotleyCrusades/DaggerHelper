# 08 Card Studio And Card Products

## Objective
Ship a full card-authoring studio integrated with the shared content/product/install platform.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- `03_CONTENT_PLATFORM_FOUNDATION.md` shipped.
- Core WCE routes from phase `04` available.

## Fixed Decisions Inherited
- Card products follow same version immutability and install model.
- Campaign installs use snapshot behavior with lineage conflict warnings.

## User-Facing Outcomes
- Users can author domain-first cards with live preview.
- Card art upload/crop and export (PNG/PDF) are supported.
- Cards can be packaged into products and installed through shared pipeline.

## Routes, Components, Services, Files
- Add:
  - `src/app/(dashboard)/dashboard/world/cards/**/*`
  - `src/components/cards/*`
  - `src/app/api/cards/*`
  - card asset storage helpers

## Data/API/Interface Changes
- Card record model and validation.
- Card asset metadata + storage references.
- Packaging hooks for product bundle inclusion.

## Permissions And Roles
- Creator owns personal card drafts.
- Publishing/install permissions follow product/campaign policy.

## Acceptance Tests
- Card create/edit/delete works.
- Live preview reflects card payload changes.
- Art upload/crop persists and renders.
- PNG/PDF export succeeds.
- Card product install path resolves in campaign.
- Build/test/lint/typecheck pass.

## Exit Gate
- Card creation is WCE-native and no longer depends on campaign settings authoring.

## Non-Goals
- Legacy campaign card management retention.
- Commerce model redesign.

## Rollback
- Trigger:
  - card runtime/export defects block creator workflow
- Action:
  - hide card studio routes and preserve API/data for later patch
- Data Impact:
  - authored cards/assets remain stored
