# 03 Content Platform Foundation

## Objective
Introduce the shared content, product, entitlement, install, moderation, and document data foundation used by all later creator/catalog/campaign flows.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- Phase `02` navigation/dashboard baseline shipped.
- Runtime schema apply process validated (`pnpm db:schema:apply`).

## Fixed Decisions Inherited
- Immutable product versions.
- Entitlement and delist rules.
- Latest-install overwrite with lineage collision warnings.
- Warn+archive uninstall policy.
- Builder resolution: `official + installed campaign content` only.

## User-Facing Outcomes
- No mandatory large UI release in this phase.
- Stable backend primitives and adapter behavior available for subsequent UI phases.

## Routes, Components, Services, Files
- Add/Edit database and services:
  - `src/lib/database/schema.sql`
  - `src/lib/content/types.ts`
  - `src/lib/content/schemas.ts`
  - `src/lib/content/queries.ts`
  - `src/lib/content/mappers.ts`
  - `src/lib/content/install.ts`
  - `src/lib/content/catalog.ts`
  - `src/lib/content/documents.ts`
- Add APIs:
  - `src/app/api/content/*`
  - `src/app/api/products/*`
  - adapter updates in legacy homebrew APIs

## Data/API/Interface Changes
- Add tables:
  - `homebrew_entities`
  - `content_products`
  - `content_product_versions`
  - `content_bundle_items`
  - `content_documents`
  - `user_content_entitlements`
  - `campaign_content_installs`
  - `campaign_install_suggestions`
  - `content_reports`
  - `moderation_actions`
- Include Stripe placeholder columns/IDs required for phase `07`.
- Introduce adapter cutoff rules:
  - moved kinds write to new store only
  - reads are `new-first, legacy-fallback`

## Permissions And Roles
- Personal content CRUD is owner-only.
- Campaign install mutations stay owner-only (execution in phase `05`).
- Moderator/admin actions exist but can remain internal until moderation UI phase.

## Acceptance Tests
- Schema applies cleanly to Supabase runtime.
- New APIs pass auth and ownership checks.
- Legacy routes continue returning expected data during adapter period.
- Collision detection payload includes current winner + incoming replacement metadata.
- Build/test/lint/typecheck all pass.

## Exit Gate
- Backend model is stable enough that WCE, campaign installs, and catalog UIs can build on it without extra schema redesign.

## Non-Goals
- Full WCE UI migration.
- Campaign content manager UI.
- Community storefront UI.
- Payment processing.

## Rollback
- Trigger:
  - schema/API regression blocks existing character/campaign/adversary flows
- Action:
  - keep legacy adapters active and disable new store writes for affected kinds
  - revert non-essential new API routes until stability restored
- Data Impact:
  - additive schema only; no required backfill/destructive migration in this phase
