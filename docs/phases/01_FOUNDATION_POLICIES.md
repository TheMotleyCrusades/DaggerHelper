# 01 Foundation Policies

## Objective
Lock cross-cutting platform rules so all implementation phases inherit one consistent set of decisions.

## Definitions
- `lineage_key`: stable family identifier for equivalent content across sources and versions (for example, an official item and a creator-modified campaign override of that same item lineage).
- `product version`: immutable snapshot of a product's bundle items and document payload at publish time.
- `entitlement`: durable user right to access a product version's protected content.

## Fixed Decisions

### 1. Product and Version Immutability
- Published product versions are immutable.
- Any change to published content creates a new version.
- Campaign installs always reference a specific version and snapshot from that version.

### 2. Entitlement Rules
- Free products:
  - A user claim creates an entitlement record immediately.
  - Claim does not auto-install to campaigns.
- Paid products:
  - Paid listings remain disabled until Stripe phase (`07`) is complete.
  - Before phase `07`, paid products may exist as drafts but cannot be publicly purchasable.
- Visibility:
  - Public users can see catalog metadata.
  - Protected content requires entitlement.
  - Teaser/sample content can be shown without entitlement.
- Delisting:
  - Delisted products are hidden from new discovery flows but remain accessible to entitled users.

### 3. `lineage_key` Conflict Policy
- Why this exists:
  - Multiple installed products may provide different variants of the same lineage.
- Conflict winner policy:
  - Most recently installed content wins and overwrites effective resolution for matching `lineage_key`.
  - Official baseline is always fallback when no installed override exists.
- UI requirement:
  - Before install confirmation, show a collision warning listing every `lineage_key` that will be overwritten.
  - Warning must include current winner and incoming replacement for each collision.
  - Campaign Content Manager must show effective winner per conflict after install.

### 4. Uninstall Policy
- Behavior is `warn + archive`.
- Uninstall never hard-deletes campaign snapshot rows used by active references.
- On uninstall request:
  - show impact report (characters/builders/sheets affected)
  - confirm action
  - archive installed content and preserve references
  - surface broken-reference warnings where needed

### 5. Builder Resolution Rule
- Campaign builders resolve from `official + installed campaign content` only.
- Personal drafts are never included in campaign builders unless installed through campaign flow.

### 6. Save To Campaign One-Item Product Policy
- `Save to campaign` from creator tooling must use install pipeline parity.
- System creates hidden one-item product/version artifacts as needed.
- These hidden artifacts are install-only records and are not public catalog listings.

### 7. Member Install Suggestion Policy
- Campaign owner is the only role that can install/remove campaign content in this phase.
- Non-owner members can submit install suggestions.
- Suggestions are reviewable by owner and are non-mutating until owner approval.

### 8. Creator Score Formula (v1)
Use a transparent weighted score for `/dashboard` and `/community`:

`creator_score = (published_listed_products * 25) + (free_claims * 2) + (campaign_installs * 4) + (bundle_reactions * 1) + (recent_activity_bonus) - (moderation_penalty)`

- `recent_activity_bonus`:
  - `+15` if any publish/update in last 30 days
  - `+5` if any publish/update in last 90 days and none in 30
- `moderation_penalty`:
  - `25 * upheld_moderation_actions`
- Floor at `0`.
- Keep formula in shared service for later tuning without schema change.

### 9. Moderation and Delist Policy
- Users can report products/content.
- Moderators can: `dismiss`, `warn`, `delist`, `restrict`.
- Delist keeps entitled access but blocks new claims/purchases and catalog visibility by default.
- Moderation actions are auditable and append-only.

## Phase Inheritance Contract
All later phase docs must:
- reference this file in "Fixed decisions" section
- not redefine conflicting behavior
- document any proposed policy change as an explicit amendment to this file

## Safety Defaults
- No destructive backfill required for current disposable test data.
- New writes go to new stores for migrated kinds.
- Reads use `new-first, legacy-fallback` until cleanup phase.
