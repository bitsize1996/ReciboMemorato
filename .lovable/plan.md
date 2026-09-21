# Memory Archive / Event Gallery

Adds a new gallery system to the existing Recibo Memorato site. Nothing on the current home page is redesigned — the hero, services, story, FAQs, colors and typography stay exactly as they are.

## What visitors get

**Home page teaser** — a new short "Memory Archive" block with the headline "Receipts from moments that happened.", a few recent event cards, and a link to the full archive.

**Memory Archive page (`/memories`)** — all past events as premium cards: cover photo, event name, date, optional venue, and a "VIEW MEMORIES →" action. Small receipt-style metadata line on each card (EVENT / DATE / MEMORIES count).

**Event page (`/memories/<event>`)** — event name, date and location, then four tabs: PRINT | DIGITALS | GIF | SINGLES. Only the selected tab's media loads. Each tab has its own branded empty state ("No proofs here yet.") and error state ("Memory archive temporarily unavailable.") — no technical details ever shown.

**Lightbox** — dark backdrop, large image at its original shape, previous/next, close, counter (12 / 84), download. Works with keyboard, and with swipe on phones. GIFs keep animating.

**Mobile** — two-column gallery, horizontally scrollable tabs, full-width cards, large touch targets, swipeable lightbox.

## Photos

You chose to set the gallery up with sample photos first. So:

- The gallery ships with realistic placeholder events and images, clearly marked as samples.
- The Google Drive layer is built and wired but switched off until you connect your Drive. The site will not pretend it is live.
- When you're ready, you connect your Google Drive once and the same gallery starts showing real folders — no rebuild of the gallery itself.

Expected Drive layout: `RECIBO MEMORATO / EVENT GALLERIES / [EVENT NAME] / {PRINT, DIGITALS, GIF, SINGLES}`. New uploads appear on the site automatically within a few minutes, without anyone editing the site.

## Admin page

A private page at `/admin/events`, reachable only after you sign in:

- Add or edit an event: name, date, location, cover image, and the folder links for the event and its four categories.
- Show/hide an event from the public archive, and reorder.
- No source-code editing to add an event ever again.

Sign-in is email + password, and only accounts you mark as admin can open it. Visitors never need an account.

## Technical notes

- Data: a `events` table (id, slug, name, event_date, location, cover_url, drive folder ids for root/print/digitals/gif/singles, published, sort order) plus a `user_roles` table with an `admin` role and a `has_role` security-definer function. Public read is limited to published events; writes are admin-only. Grants issued alongside RLS.
- Routes: `src/routes/memories.index.tsx`, `src/routes/memories.$slug.tsx`, `src/routes/admin/events.tsx` under an authenticated layout.
- Media listing goes through a server function (`src/lib/gallery.functions.ts`) that calls a provider module (`drive.server.ts`). That module has two implementations behind one interface: `mock` (sample fixtures, default) and `drive` (Google Drive via the Lovable connector gateway, server-side only — no keys in the browser). Selection is by configuration, not by editing components.
- Listing responses cached server-side with a short TTL (~5 min) and revalidated in the background, so Drive uploads surface without a rebuild.
- Per-category paginated fetch (page token / infinite scroll), `loading="lazy"`, `decoding="async"`, responsive `sizes`, Drive thumbnail links for grid tiles and full-resolution only in the lightbox. GIFs show a static poster in the grid and animate in the lightbox to avoid loading everything at once.
- Styling reuses the existing tokens and receipt motifs in `src/styles.css`; new classes only, no edits to existing sections beyond adding the teaser block.
- Each new page gets its own head() title/description/OG tags.

## Build order

1. Database: events + roles, policies, grants.
2. Gallery data layer with mock provider and caching.
3. Archive page, event page with tabs, lightbox, empty/error states.
4. Home page teaser + nav link.
5. Auth + admin events page.
6. Google Drive provider, left inactive until you connect your account.
