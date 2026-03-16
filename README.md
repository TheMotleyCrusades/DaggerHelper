# Dagger Helper (Next.js + Supabase)

Guide-aligned rebuild for Daggerheart campaign prep with:
- Adversary management and community library
- Campaign and encounter management
- Character builder wizard (6 steps) with export/share
- GM customization console for campaign-level character rules and custom card/equipment content

## Run Locally

1. Install dependencies:

```bash
pnpm install
```

2. Add environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Start dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key Scripts

- `pnpm dev` - start local preview
- `pnpm lint` - run ESLint
- `pnpm test` - run Vitest suite
- `pnpm build` - production build verification
- `pnpm db:seed:runtime` - apply runtime seed data
- `pnpm db:import:adversaries` - import official adversaries from tier text dataset

## Implemented Character Builder Scope

- Wizard steps 1-6:
  - Basic identity
  - Trait assignment
  - Weapons and armor
  - Domain card deck building (mobile-friendly tap controls + desktop drag/drop ordering)
  - Background and story
  - Review/finalize
- Character management pages:
  - `/characters`
  - `/characters/[id]`
  - `/characters/[id]/edit`
- Export and sharing:
  - `/api/characters/[id]/export/pdf`
  - `/api/characters/[id]/export/json`
  - `/api/share`
  - `/share/[shareId]`
- GM customization console:
  - `/campaigns/[id]/settings`
  - Character sheet rules
  - Domain card management
  - Weapon and armor management

## Planning Docs

- `GM_CONSOLE_CUSTOMIZATION_EXPANSION.md` - proposed next-phase expansion of the GM console into a full campaign customization system for resources, currencies, terminology, sheet layout, and broader homebrew support

## Testing Snapshot

- Lint: passing
- Tests: passing (`4 files / 10 tests`)
- Build: passing
