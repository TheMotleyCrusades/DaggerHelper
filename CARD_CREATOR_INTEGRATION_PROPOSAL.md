# Card Creator Integration Proposal

Updated: 2026-03-14
Target app: `C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next`

## Recommendation

Build a dedicated card creator into the active Next app, but do it in two layers:

1. Ship a first version that solves the immediate homebrew workflow for campaign-owned cards.
2. Structure the data model so it can expand beyond domain cards into ancestry, community, subclass, class, and equipment cards without a rewrite.

Do not copy third-party art, fonts, or template assets directly from the two reference sites. Reuse your existing SRD-derived data where you already have it, recreate missing frame assets in-house, and only use logos/icons/assets that are clearly permitted by Daggerheart's public license terms.

## What the Reference Sites Are Doing

### Official cardcreator.daggerheart.com

Observed workflow from the live bundle and page metadata:

- Template-first flow.
- Sidebar of templates grouped by card type.
- Template preview before creation.
- "Create" action opens a live editable card instance.
- Multiple live cards can be open at once via header tabs.
- Live preview updates immediately as values change.
- Card properties live in a sidebar.
- Header image upload supports resize/crop/reposition.
- Base settings include layout details like thresholds and artist credit.
- Export supports both PNG and PDF.
- The app appears client-first and storage-limited, with local usage checks and a cleanup flow for unused images.

What matters architecturally:

- It is optimized for fast iteration, not community publishing.
- Templates are first-class.
- The rendering layer is HTML/CSS-driven and exportable.
- It treats "working cards" separately from source templates.

### DaggerheartBrews `/card/create`

Observed from the public source repo:

- Dedicated route with split editor/preview layout.
- Zustand store for card state.
- Type-driven forms:
  - base details
  - image upload/crop
  - card-type-specific properties
  - rules text editor
  - preview settings
- Live HTML/CSS card renderer.
- PNG export in-browser via `@jpinsonneau/html-to-image`.
- Save flow persists cards through API routes.
- "Use as template" flow clones an existing saved card back into the editor.
- Official options like domains/classes are loaded from API.
- Rich text and helper insertions reduce authoring friction.

What matters architecturally:

- It is a strong implementation reference for forms, state, and preview/export.
- It adds persistence and template reuse, but its schema is still card-builder-specific.
- It is closer to what your users will expect than the official tool because it supports saved homebrew.

## What You Already Have

The active app already contains several pieces we can build on:

- Campaign-scoped homebrew metadata storage in [`src/lib/campaign-metadata.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\lib\campaign-metadata.ts)
- Existing campaign homebrew persistence helpers in [`src/lib/homebrew-api.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\lib\homebrew-api.ts)
- Existing campaign customization console at [`src/app/campaigns/[id]/settings/page.tsx`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\app\campaigns\[id]\settings\page.tsx)
- Existing domain card API and compatibility model in [`src/app/api/domain-cards/route.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\app\api\domain-cards\route.ts) and [`src/lib/constants/domains.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\lib\constants\domains.ts)
- Existing SRD card dataset and extracted card art references in [`src/lib/srd-cards.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\lib\srd-cards.ts) and [`src/lib/data/srd-cards.json`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\lib\data\srd-cards.json)
- Existing homebrew management UI for domain cards in [`src/app/campaigns/[id]/settings/DomainCardManagement.tsx`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\app\campaigns\[id]\settings\DomainCardManagement.tsx)

This means the app is not starting from zero. The main missing pieces are rendering, editing UX, asset handling, and community publishing.

## Current Gaps

### Product gaps

- No true card editor route.
- No live card renderer matching Daggerheart-style cards.
- No template browser.
- No image upload pipeline in the active Next app.
- No PNG export flow for card output.
- No PDF card sheet export flow.
- No community card library; community currently centers on adversaries.

### Data-model gaps

Your current `DomainCardDefinition` is too narrow for a general card creator. It assumes:

- `class`
- `tier`
- `traitBonuses`
- `evasion`
- `moveAbility`
- `fragileText`
- `featureText`

That works for domain cards, but not for:

- ancestry cards
- community cards
- subclass cards
- class cards
- equipment cards
- future custom card families

If you continue extending `DomainCardDefinition`, the model will become brittle quickly.

### Technical gaps

- No image storage or upload abstraction in the Next app.
- No rich text editor dependency in the Next app.
- No reusable card rendering system.
- No public-card table or publication workflow.
- No favourite/like model for cards equivalent to adversaries.

## Recommended Architecture

## 1. Add a generic `HomebrewCardDefinition`

Create a new card model instead of overloading the current domain-card shape.

Recommended base shape:

```ts
type HomebrewCardCategory =
  | "domain"
  | "class"
  | "subclass"
  | "ancestry"
  | "community"
  | "equipment";

type HomebrewCardDefinition = {
  id: string;
  campaignId: number | null;
  ownerUserId?: number | null;
  category: HomebrewCardCategory;
  templateSource: "official" | "campaign" | "community" | "blank";
  sourceTemplateId?: string | null;
  name: string;
  subtitle?: string;
  subtype?: string;
  artUrl?: string | null;
  artistCredit?: string | null;
  legalCredit?: string | null;
  rulesHtml?: string;
  tags: string[];
  visibility: "campaign" | "private" | "public";
  render: {
    primaryDomain?: string | null;
    secondaryDomain?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    primaryIconUrl?: string | null;
    secondaryIconUrl?: string | null;
    showBorder: boolean;
    showArtist: boolean;
    showCredits: boolean;
    showPlaceholderImage: boolean;
  };
  stats: {
    level?: number | null;
    tier?: number | null;
    stress?: number | null;
    evasion?: number | null;
    thresholds?: [number, number] | null;
    hands?: number | null;
    armor?: number | null;
  };
  domainRules?: {
    cardType?: "ability" | "spell" | "grimoire";
    moveAbility?: string;
    fragileText?: string;
    featureText?: string;
    traitBonuses?: Record<string, number>;
    classKey?: string;
    domainKey?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
};
```

Why:

- It supports immediate domain-card needs.
- It cleanly expands to non-domain card types.
- It separates rendering concerns from gameplay metadata.
- It makes template reuse and publication straightforward.

## 2. Keep domain-card compatibility as an adapter

Do not break the current character builder.

Instead:

- keep the existing `DomainCardDefinition`
- store new editor cards in a generic collection
- derive `DomainCardDefinition` from `HomebrewCardDefinition` when `category === "domain"`

That lets the character builder keep consuming domain cards while the card creator evolves independently.

## 3. Add a dedicated card creator route

Recommended routes:

- `/campaigns/[id]/cards`
- `/campaigns/[id]/cards/new`
- `/campaigns/[id]/cards/[cardId]`
- `/community/cards`
- `/community/cards/[cardId]`

Why not keep this only inside the current homebrew tab:

- the existing campaign settings page is already overloaded
- card creation needs more horizontal space
- live preview and asset controls deserve a dedicated workspace

The current homebrew tab should link into the card studio rather than host the whole experience inline.

## 4. Use a template + live-edit workflow

Recommended UX:

- Left sidebar:
  - official templates
  - campaign templates
  - my recent cards
- Center:
  - live card preview
- Right panel:
  - card fields
  - art controls
  - render settings
  - export/publish actions

Start with one live card at a time. Multi-tab editing like the official creator is useful, but it is not required for V1.

## 5. Use HTML/CSS rendering, not canvas-first rendering

Render cards as React components sized to a fixed card aspect ratio, then export those DOM nodes to PNG/PDF.

Why:

- easier iteration and styling
- easier responsive preview
- easier conditional layouts by card type
- matches both reference implementations

Recommended export stack:

- PNG: `@jpinsonneau/html-to-image` or `html2canvas`
- PDF: keep using `pdf-lib`, embedding rendered PNGs onto printable sheets

## 6. Store user art in Supabase Storage

Do not store saved card art as base64 inside campaign metadata.

Recommended:

- bucket: `card-art`
- folder layout:
  - `users/{userId}/cards/{cardId}/original/*`
  - `users/{userId}/cards/{cardId}/cropped/*`

Store crop metadata in the card record so the preview can be recreated and exports remain stable.

## Asset and Data Strategy

## Safe to reuse from your current app

- SRD card metadata already in repo
- existing extracted SRD image references already in repo
- your current domain gating logic
- your campaign metadata and homebrew persistence helpers

## Needed, but should be recreated or explicitly sourced

- card frame overlays
- divider art
- badges and number medallions
- domain icon treatments
- typography choices if the current reference font is not licensed for reuse

## Do not directly scrape/copy without confirming rights

- official site artwork
- DaggerheartBrews static card frame assets
- non-SRD official book art
- proprietary font files

## Important licensing note

Use the Daggerheart Community Gaming License as the baseline for what can appear in a public-facing tool, and treat official art/font reuse as restricted unless you can verify permission. Your repo already has SRD-derived card data and image references; those are a safer foundation than lifting site assets wholesale.

## Proposed Phases

## Phase 1: Campaign Card Studio

Goal: Make campaign-scoped homebrew card creation actually usable.

Scope:

- dedicated card studio route
- generic `HomebrewCardDefinition` model
- domain-card creation first
- template picker:
  - blank domain card
  - official SRD domain cards as templates
  - existing campaign homebrew cards as templates
- live preview
- image upload + crop
- structured rules fields
- PNG export
- save/update/delete inside campaign

Backend:

- new `/api/cards` routes
- adapter layer from generic cards to existing domain-card consumers
- Supabase Storage bucket for card art

UI:

- card browser in campaign context
- replace the current minimal `DomainCardManagement` create form with entry links into the editor

Why this phase first:

- it immediately improves the current weakest homebrew workflow
- it reuses your existing domain-card usage in the character builder
- it avoids a full public publishing system before the editor is proven

## Phase 2: More Card Families

Scope:

- ancestry cards
- community cards
- subclass cards
- class cards
- equipment cards
- richer conditional property forms by category
- template sets for each card family

Data work:

- expand discriminated union handling in the editor
- add render variants per category

## Phase 3: Community Publishing

Scope:

- publish/unpublish cards to public library
- `/community/cards`
- card detail pages
- favourites/likes
- author attribution
- "use as template" from community items

Recommended storage model:

- separate published card records from campaign metadata
- keep campaign-owned draft/source card editable by owner
- publish a snapshot for community display

Why separate snapshot publishing:

- avoids accidental breaking edits on published community references
- supports moderation later
- makes caching simpler

## Phase 4: Print and Sheet Integration

Scope:

- printable PDF sheets of card pages
- add selected homebrew cards to exports/share pages
- optional card packs by campaign
- batch export

## Concrete File-Level Plan

Recommended new files:

- `src/lib/cards.ts`
- `src/lib/card-rendering.ts`
- `src/lib/card-assets.ts`
- `src/app/api/cards/route.ts`
- `src/app/api/cards/[id]/route.ts`
- `src/app/api/cards/[id]/publish/route.ts`
- `src/app/campaigns/[id]/cards/page.tsx`
- `src/app/campaigns/[id]/cards/new/page.tsx`
- `src/app/campaigns/[id]/cards/[cardId]/page.tsx`
- `src/app/community/cards/page.tsx`
- `src/app/community/cards/[cardId]/page.tsx`
- `src/components/cards/card-editor.tsx`
- `src/components/cards/card-preview.tsx`
- `src/components/cards/card-template-browser.tsx`
- `src/components/cards/forms/*`

Recommended modifications:

- extend [`src/lib/campaign-metadata.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\lib\campaign-metadata.ts) with a generic `cards` collection
- adapt [`src/app/api/domain-cards/route.ts`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\app\api\domain-cards\route.ts) to read domain cards from the new card model or to merge both sources during migration
- replace or downscope [`src/app/campaigns/[id]/settings/DomainCardManagement.tsx`](C:\Users\Rowan\Desktop\Dagger Helper\dagger-helper-next\src\app\campaigns\[id]\settings\DomainCardManagement.tsx)
- extend leaderboard/community systems if public card sharing is added

## Dependencies to Add in the Active Next App

Recommended:

- `@jpinsonneau/html-to-image` for PNG export
- `@origin-space/image-cropper` or equivalent for art positioning
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-text-align` if you want rich text close to DaggerheartBrews

Optional for V1:

- skip rich text editor initially and use structured sections plus textarea fields
- add TipTap in Phase 2 if authoring friction becomes a problem

My recommendation:

- V1 should avoid full rich text editing unless you want parity with DaggerheartBrews immediately.
- Structured inputs are faster to ship and easier to validate.

## Risks and Tradeoffs

## If you build only a domain-card editor

Pros:

- fastest path
- tight fit with current character builder

Cons:

- you will need another editor architecture later for ancestry/community/class/subclass cards

## If you build a generic card editor now

Pros:

- future-proof
- better alignment with your stated goal of strong homebrew creation

Cons:

- more upfront design work
- slightly slower first release

Recommended compromise:

- generic data model now
- domain-card UI first

## Final Recommendation

Build this into `dagger-helper-next`, not the legacy Vite app.

Use the official creator as the workflow reference:

- template browser
- live editable preview
- export-ready cards

Use DaggerheartBrews as the implementation reference:

- state model
- split editor/preview layout
- image crop flow
- save/template reuse flow

But for your own app:

- keep campaign ownership as the first-class concept
- introduce a generic card model instead of stretching `DomainCardDefinition`
- use your existing SRD dataset and campaign metadata infrastructure
- recreate visual assets cleanly instead of scraping/copying site assets directly

If you want the shortest path to value, Phase 1 should be: campaign-scoped domain card studio with template cloning, image upload/crop, PNG export, and save/edit/delete.
