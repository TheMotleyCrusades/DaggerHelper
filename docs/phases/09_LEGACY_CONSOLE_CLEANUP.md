# 09 Legacy Console Cleanup

## Objective
Retire redundant campaign settings homebrew authoring once WCE + campaign install parity is complete.

## Entry Criteria And Dependencies
- `01_FOUNDATION_POLICIES.md` approved.
- Phases `04` and `05` shipped and validated.
- Phase `08` shipped for card authoring parity.

## Fixed Decisions Inherited
- Campaign writes happen through install pipeline.
- Builder resolution remains official + installed campaign content.

## User-Facing Outcomes
- Campaign settings console focuses on rules/sheet behavior only.
- Homebrew authoring tools are removed from old GM-centric settings UI.
- Installed content summary links users to WCE and Campaign Content Manager.

## Routes, Components, Services, Files
- Edit:
  - `src/app/campaigns/[id]/settings/page.tsx`
  - `src/app/campaigns/[id]/settings/HomebrewLibraryManagement.tsx`
  - `src/app/campaigns/[id]/settings/DomainCardManagement.tsx`
- Remove transitional adapters where safe.

## Data/API/Interface Changes
- Remove deprecated authoring entry points from settings UI.
- Keep backward-safe read adapters only where unresolved dependencies exist.
- Finalize adapter deprecation checklist from phase `03`.

## Permissions And Roles
- Campaign settings remains owner-focused for rule behavior.
- Content creation remains in WCE.

## Acceptance Tests
- No direct homebrew authoring remains in campaign settings.
- Installed-content summary is visible and navigable.
- WCE + Campaign Content Manager cover prior authoring use cases.
- No broken links from old settings paths.
- Build/test/lint/typecheck pass.

## Exit Gate
- Legacy GM-centric homebrew console paths are retired without functional loss.

## Non-Goals
- New content model expansion.
- Commerce feature work.

## Rollback
- Trigger:
  - parity gap discovered in WCE/install flows after cleanup
- Action:
  - temporarily restore targeted legacy entry points behind a feature flag
- Data Impact:
  - no destructive data operations; adapter restore only
