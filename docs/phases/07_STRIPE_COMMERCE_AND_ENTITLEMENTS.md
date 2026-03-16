# 07 Stripe Commerce And Entitlements

## Objective
Enable production payment and payout flow for official and creator paid products using hosted Stripe flows only.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- `03_CONTENT_PLATFORM_FOUNDATION.md` shipped.
- `06_COMMUNITY_CATALOG_AND_MODERATION.md` shipped.
- Stripe keys/webhook secrets configured in environment.

## Fixed Decisions Inherited
- Paid products were non-purchasable before this phase.
- Entitlements are authoritative for protected content access.

## User-Facing Outcomes
- Users can purchase paid products via hosted Stripe Checkout.
- Creator payout onboarding is available via Stripe Connect.
- Entitlements are granted/revoked according to webhook-confirmed payment state.

## Routes, Components, Services, Files
- Add:
  - checkout session routes
  - webhook routes
  - order/payment service modules
  - creator onboarding/account-link routes

## Data/API/Interface Changes
- Persist checkout/order identifiers and Stripe references.
- Webhook idempotency records for safe replay.
- Entitlement grant/revoke tied to payment lifecycle.
- Refund/dispute hook handling.
- Platform fee capture wiring.

## Permissions And Roles
- Buyers can purchase listed paid products.
- Creators can onboard for payouts where applicable.
- Admin/official publisher flow supports official paid releases.

## Acceptance Tests
- One official product purchase grants entitlement end-to-end.
- One creator product purchase grants entitlement end-to-end.
- Webhook idempotency prevents duplicate grants.
- Refund/dispute updates entitlement state according to policy.
- Build/test/lint/typecheck pass.

## Exit Gate
- Paid commerce flow is production-safe with webhook-backed entitlement correctness.

## Non-Goals
- Alternative payment providers.
- In-app card capture/PCI handling.

## Rollback
- Trigger:
  - entitlement mismatch or payment webhook instability
- Action:
  - disable new checkout entry points
  - keep webhook ingestion with safe no-op fallback while reconciling orders
- Data Impact:
  - order and entitlement logs remain for reconciliation
