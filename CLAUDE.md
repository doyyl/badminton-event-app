# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page React app for running a corporate badminton tournament event day: guest self-check-in, food/drink claiming via QR codes, court check-ins, a referee scoring panel, live results, and a staff admin panel. No backend server — the client talks directly to Supabase (Postgres + RLS) and to a published Google Sheet (read-only schedule/standings).

## Commands

```bash
npm run dev       # start Vite dev server on port 5173
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

There is no test suite, linter, or type checker configured in this repo — don't invent commands for them.

## Environment

Copy `.env.example` to `.env`. Vite-exposed vars (all client-side, public):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project (see `src/lib/supabase.js`)
- `VITE_ADMIN_PASSWORD`, `VITE_REFEREE_PASSWORD` — plaintext gate passwords checked client-side (default fallbacks `smash2024` / `referee2024` if unset)

Auth model: there is no real authentication. `/admin` and `/referee` are protected only by a password compared client-side, then a flag in `sessionStorage` (`badminton_admin`, `badminton_referee`, `badminton_guest`). All Supabase tables use permissive RLS policies (public read/write) — write protection is enforced by the UI, not the database. Don't "fix" this with real auth unless asked; it's intentional for a single-day event app.

## Data layer

Two independent data sources, queried directly from the browser:

1. **Supabase** (`src/lib/supabase.js`) — the source of truth for attendees, food claims, match results, and live court/match state. Schema lives in `supabase/schema.sql` (base) and `supabase/referee_schema.sql` (courts/matches, duplicated into the base schema's later section — keep both in sync if you alter court/match tables). Key tables:
   - `attendees` — keyed by `external_id` (pre-registered IDs like `A1`, `S1`; walk-ins get auto-assigned `W<n>` — see `CheckIn.jsx`'s max-existing-number logic, not a count, to avoid collisions after deletions)
   - `food_items` / `food_claims` — claims are inserted through the `claim_food` Postgres function (`SECURITY DEFINER`, advisory-locked per attendee+item) so concurrent scans at multiple stations can't double-claim past quota. Always go through this RPC for claims; never insert into `food_claims` directly.
   - `results`, `event_config` (key/value: MOTM, announcement text, seating map URL)
   - `courts`, `matches`, `court_checkins` — referee/court-day flow
   - Realtime is enabled (Supabase publication) on `attendees`, `food_claims`, `results`, `event_config`, `matches`, `court_checkins` — pages that show live state subscribe rather than poll.

2. **Google Sheets** (`src/lib/googleSheet.js`) — published-CSV export of the tournament bracket/schedule, fetched and parsed by hand (no API key). `fetchSchedule()` parses the main published sheet; `fetchStandings()` pulls two specific `gid`s (`GID_BASIC`, `GID_EXPERT`) and parses a structurally different "team1 row, team2 row" bracket layout. This parsing is brittle by nature (column positions, Thai status strings like `กำลังแข่งขัน`/`แข่งขันจบ`) — if the spreadsheet's structure changes, these parsers need matching updates. `findScheduleRowByName` cross-references standings (player name) to schedule (match number) since the schedule sheet itself has no player names.

## Routing / page structure (`src/App.jsx`)

Single `BrowserRouter` with route-level lazy-loading for everything except the critical check-in path (`CheckIn`, `GuestPage`, `AdminLogin`, `AdminLayout` are eager-loaded; everything else is `lazy()`-split). Three independent guarded areas, each gated by its own `sessionStorage` flag, not shared:

- **Guest flow**: `/` (`CheckIn.jsx`, email lookup or walk-in registration) → `/guest` (dashboard) → `/guest/scan` (QR camera scan for food, via `html5-qrcode`) and `/guest/food`. Guarded by `GuestGuard` (checks `badminton_guest`).
- **Court flow**: `/court/:courtId` (`CourtCheckinPage.jsx`) — a player scans/visits a per-court URL to check in to their scheduled match; flips the match to `active` status. Not guarded by `GuestGuard` itself but redirects to `/` and stashes the intended URL in `court_redirect` if no guest session exists.
- **Referee flow**: `/referee` (court grid) → `/referee/:courtId` (`RefereeCourtPage.jsx`, score entry). Own password gate, independent of guest/admin sessions.
- **Admin flow**: `/admin` (login) → `/admin/dashboard|food|results|config|qrcodes|import`, wrapped in `AdminLayout` + `AdminGuard`.
- `/results` is public (no guard) — spectator-facing live bracket/standings view.

## Styling

Tailwind, configured in `tailwind.config.js`. Despite class names like `dark.bg`/`dark.card` and `bg-dark-bg` appearing in JSX, the actual theme is **light** — those are legacy color-token names kept so old class references still compile; they map to light hex values now. Don't assume `dark-*` classes mean a dark UI when reading or writing components. Primary brand color is `primary` (`#dc2626`, red); `court`/`shuttle` are legacy aliases pointing at the same palette.

## Notable conventions

- Pages are flat files under `src/pages/` (and `src/pages/admin/`) — one file per route, not split into sub-component folders. Follow this when adding new pages instead of introducing a new structure.
- QR payloads are plain strings with a type prefix, e.g. `FOOD:<item_id>` (checked in `ScanPage.jsx`). If you add new scannable QR types, follow the same `PREFIX:value` convention.
- Walk-in attendee IDs (`W<n>`) are derived by scanning existing `external_id`s for the max `W`-prefixed number, not a row count — preserves uniqueness even after deletions (see git history fix `1451f0d`).
