
# Navigation & Page Grouping Restructure

## Why this is needed

Auditing `src/config/fmNavigation.ts`, the hub pages in `src/pages/hubs/`, and the ~180 routes in `src/App.tsx`, the current IA has clear problems:

- **Duplicated taxonomies** — every section is defined twice: once in `FM_MODULES` (top nav + sidebar) and once in a `CategoryHub` tile page. The two disagree (e.g. `MusicHubPage` lists Education, Music Videos, Country Charts; the `Music` module sidebar doesn't).
- **Orphaned pages** — Music Videos, Acting, Radio, TV, Newspapers, Magazines, Podcasts, Films, Websites, Self-Promotion, Major Events, Eurovision, Busking, Open Mic, Jam Sessions, Housing, Personal Vehicles, Casino, Lottery, Family, Relationships, Producer/Modeling/Clothing Designer, Hall of Fame, Journal, Premium Store, Blind Boxes are reachable only from a hub tile or a deep link — they never appear in the sidebar of any module.
- **Wrong module ownership** — Politics sits under `World` in the module bar but under `Career & Business` in the hub. Merchandise appears in both `Career` and `Store`. Statistics appears in `Overview` sidebar and in `Character` hub. Producer Career, Modeling, Clothing Designer are tile-only.
- **Live vs Band split is arbitrary** — Rehearsals, Setlists, Stage Setup, Stage Equipment toggle between the two; Open Mic / Jam / Busking aren't in either sidebar.
- **Hub layer is redundant** — `/hub/character`, `/hub/music`, `/hub/band-live`, `/hub/world-social`, `/hub/career-business` repeat what the sidebar already does, and use a different grouping.

## Target information architecture

Eight top-level modules. Every page in the app maps to exactly one module and appears in that module's sidebar. Hubs become the module's landing page (the tile grid IS the module home), so the duplication collapses.

```text
1. OVERVIEW       Dashboard, Inbox, Schedule, Journal, Today's News, Statistics, Achievements
2. CHARACTER      Characters roster, Edit, Avatar, Skin store, Tattoos, Wellness, Gear, Inventory,
                   Housing, Personal Vehicles, Family, Relationships, Legacy, Hall of Immortals
3. MUSIC          Songwriting, Stage Practice, Education, Recording Studio, Release Manager,
                   Releases, Music Videos, Streaming Platforms, Charts, Country/Christmas Charts,
                   Song Rankings, Song Market
4. BAND & LIVE    Band Manager, Repertoire, Chemistry, Setlists, Rehearsals, Crew, Riders,
                   Vehicles, Stage Setup, Stage Equipment, Browse/Finder/Rankings/Fame Map,
                   Gig Booking, My Gigs, Open Mic, Jam Sessions, Busking, Tours, Festivals,
                   Major Events, Eurovision, Awards
5. CAREER         Finances, Sponsorships, Employment, Teaching, Offers, PR, Producer Career,
                   Modeling, Acting, Clothing Designer, Companies (Label, Venues, Merch Factory,
                   Logistics, Security, Studios), Merchandise
6. MEDIA          Radio, TV Shows, Newspapers, Magazines, Podcasts, Films, Websites,
                   Self-Promotion, PR History  (consumer-facing media browsing — distinct from PR)
7. WORLD          World Map, Cities, Travel, World Pulse, World Parliament, Political Party,
                   Party Standings, Politics Career, City Election/Mayor, Landmarks,
                   Seasonal Events Calendar, Today's News (cross-link)
8. SOCIAL         Social Hub, Friends, Twaater (+ messages/notifs/analytics), DikCok, Gettit,
                   Casino, Lottery, Underworld, Nightclubs, Premium Store, Blind Boxes
```

Admin stays as a 9th module, visible only to admins.

### Key reassignments (vs today)

- **Politics** → moves out of `World` sidebar duplication and out of `Career` hub; lives in **World** only.
- **Merchandise** → leaves `Store`; lives in **Career** (it's a business line).
- **Gear / Inventory / Clothing Shop / Tattoo Parlour / Housing / Vehicles** → leave `Store`; live in **Character** (personal property).
- **Producer / Modeling / Acting / Clothing Designer** → consolidated under **Career → Creative Industries**.
- **Radio / TV / Newspapers / Magazines / Podcasts / Films / Websites** → new **Media** module (consumer side), separate from `Social` (peer platforms) and from `PR` (outbound career action).
- **Casino / Lottery / Underworld / Nightclubs** → **Social** (nightlife & vice), removed from World/Commerce.
- **Open Mic / Jam Sessions / Busking / Rehearsals / Setlists** → all under **Band & Live** (merged the two modules — the split was artificial).
- **Statistics / Journal / Today's News / Achievements** → **Overview** (the "look back" surface).
- **`Store` module is retired**; its content moves to Character/Career/Social as above. The Premium Store stays under Social as the cosmetic/monetisation entry point.

## Implementation

Pure presentation work — no route changes, no business logic, no DB. Only nav config and hub pages.

### Files to edit

1. **`src/config/fmNavigation.ts`** — rewrite `FM_MODULES` to the 8-module structure above. Each module gets:
   - `subTabs` = 4–6 most-used pages in that module
   - `sidebar` = 2–4 labelled groups covering every page that module owns
   - `matchPaths` = every route prefix the module owns, so `findModuleForPath` resolves correctly and the active highlight is right.
   Drop the `commerce` module entry.

2. **`src/pages/hubs/`** — rewrite each hub's tile list so it mirrors the matching module's sidebar exactly (same groups, same order). Hubs become the visual landing page; the sidebar becomes the textual index of the same content. Specifically update:
   - `CharacterHub.tsx` — add Housing, Personal Vehicles, Family, Relationships, Inventory, Clothing Shop; group as Identity / Property / Relationships / Legacy.
   - `MusicHubPage.tsx` — add Music Videos, Christmas Charts; remove Education (Career owns it for the bookable course; Music keeps Stage Practice + Songwriting).
   - Rename `BandLiveHub.tsx` → keep file, retitle to "Band & Live" and add Open Mic / Jam / Busking / Major Events / Eurovision groups.
   - `CareerBusinessHub.tsx` — remove Politics group; add Acting, consolidate Creative Industries; keep Companies group.
   - Rename `WorldSocialHub.tsx` → split into:
     - `WorldHub.tsx` (World Map, Cities, Travel, Pulse, Parliament, Politics, Seasonal Events, Landmarks)
     - `SocialHub.tsx` page (Social Hub, Twaater, DikCok, Gettit, Casino, Lottery, Underworld, Nightclubs, Premium Store, Blind Boxes)
   - New `MediaHub.tsx` for the Media module.

3. **`src/App.tsx`** — add routes for the two new hub pages (`/hub/world`, `/hub/social`, `/hub/media`) and update the legacy redirects so old `/hub/*` URLs resolve to the new hubs. No other route changes.

4. **`src/components/fm/TopStatusBar.tsx`** — the "character" shortcut already points to `/hub/character`; no change needed beyond verifying it after the rename pass.

5. **`src/components/VersionHeader.tsx`**, **`src/components/fm/BottomActionBar.tsx`**, **`src/pages/VersionHistory.tsx`** — bump to next patch version with a "Navigation IA restructure" entry per project rule.

### Out of scope

- No route URLs change (only redirects added). Existing bookmarks keep working.
- No component logic, queries, or DB touched.
- Mobile gate, landing page, auth: unchanged.

### Verification

- After edits, click each of the 8 module tabs and confirm: (a) the sidebar shows every page the module owns, (b) no page appears in two modules' sidebars, (c) `findModuleForPath` highlights the right tab when you deep-link to any of the orphaned pages above.
- Spot-check with Playwright on `/dashboard`, `/hub/music`, `/hub/band-live`, `/hub/world`, `/hub/social`, `/hub/media`, `/hub/career-business`, `/hub/character` — screenshot each.

## Open question

Should **Education** sit under **Music** (skill-building feels musical) or **Career** (it's a bookable time-sink alongside Employment/Teaching)? Current plan puts it in **Career**; happy to move it if you'd rather it sit beside Songwriting.
