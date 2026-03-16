# 05 Campaign Content Manager And Installs

## Objective
Make campaigns consume content exclusively through install workflows with conflict visibility, suggestion flow, and safe uninstall behavior.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- `03_CONTENT_PLATFORM_FOUNDATION.md` shipped.
- `04_WORLD_CREATION_ENGINE_MVP.md` available.

## Fixed Decisions Inherited
- Latest install overwrites effective lineage winner.
- Pre-install overwrite warning required.
- Uninstall is warn + archive.
- Owner-only campaign mutation.

## User-Facing Outcomes
- Campaign owners can install, remove, and inspect installed content.
- Members can suggest installs.
- Builders resolve only official + installed campaign content.

## Routes, Components, Services, Files
- Add:
  - `src/app/(dashboard)/dashboard/campaigns/[id]/content/page.tsx`
  - `src/app/api/campaign-content/*`
- Edit:
  - `src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`
  - builder query adapters and selectors

## Data/API/Interface Changes
- Install APIs support:
  - one-item installs
  - bundle installs
  - overwrite warning payloads per `lineage_key`
  - install order metadata
- Uninstall APIs support:
  - impact report
  - archive action
  - broken-reference warning metadata
- Suggestion APIs support member proposal and owner review actions.

## Permissions And Roles
- Campaign owner:
  - install/remove/reorder
  - approve/reject suggestions
- Members:
  - suggest installs only
- Non-members:
  - no install access

## Acceptance Tests
- Owner installs product version and content appears in builders.
- Pre-install warning appears when lineage collisions exist.
- Latest install becomes effective winner after confirmation.
- Member suggestion is recorded and owner can action it.
- Uninstall impact report appears and uninstall archives content with warnings.
- Build/test/lint/typecheck pass.

## Exit Gate
- Campaign content lifecycle is fully install-driven with safe warning/reporting behavior.

## Non-Goals
- Public catalog moderation UI.
- Paid purchase flow.
- Card studio.

## Rollback
- Trigger:
  - campaign builders fail to resolve required content post-install
- Action:
  - disable new install endpoints and fall back to previous campaign content resolution path
  - preserve archived install records for recovery
- Data Impact:
  - installs remain auditable snapshots; no hard deletes
