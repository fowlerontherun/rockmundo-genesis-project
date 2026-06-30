# UI redesign spec — Rockmundo-style music career game

This document defines a reusable design system and page template so every screen in the game shares one structure, regardless of which section (Music, Career, Band & Live, Media, World, Social, Admin) it belongs to. Hand this to Lovable as a single prompt/spec, or work through it section by section.

---

## 1. Design tokens

Define these once as CSS variables (or a Tailwind theme extension) and never hardcode raw hex values in a page again.

### 1.1 Base surfaces (shared, section-agnostic)
```
--bg-page: #0E0D12
--bg-surface: #17151D      /* cards, panels */
--bg-surface-raised: #1F1C28  /* pills, inputs, nested elements */
--border: #2A2733
--border-dashed: #2A2733   /* empty states, 1px dashed */
--text-primary: #F5F3F7
--text-secondary: #9B96A8
--text-muted: #7A7588
```

### 1.2 Semantic colors (status, not section — used everywhere)
```
--success: #4ADE80
--danger:  #F2555A
--warning: #F2A33D
```

### 1.3 Section accent colors
Each top-level tab gets exactly one accent, used only for: primary buttons, active tab/nav state, icon chips, progress bars, and small highlight numbers. Nothing else in the page should be tinted.

| Section       | Accent (light bg / fill) | Tinted icon chip bg | Text-on-tint |
|---------------|---------------------------|----------------------|----------------|
| Overview      | `#8B7CF6` purple          | `#1C1830`            | `#8B7CF6`      |
| Music         | `#8B7CF6` purple          | `#1C1830`            | `#8B7CF6`      |
| Band & Live   | `#F2A33D` amber           | `#3A2B12`            | `#F2A33D`      |
| Career        | `#4C9E3F` green           | `#16321A`            | `#7BC96F`      |
| Media         | `#3578DD` blue            | `#16243D`            | `#6F92D9`      |
| World         | `#3578DD` blue            | `#16243D`             | `#6F92D9`      |
| Social        | `#D4537E` pink            | `#3A1828`            | `#E08AAE`      |
| Admin         | `#9B96A8` gray            | `#1F1C28`             | `#9B96A8`      |

Rule: pick ONE accent per top-level tab. Sub-pages inherit the parent tab's accent — do not introduce a new color per sub-page (this is what's currently broken: Underworld is purple, Career is green, Band & Live is orange, all under inconsistent logic).

### 1.4 Typography
```
Display / headings: a geometric sans with some character (e.g. Space Grotesk, Sora) — used only for page titles (h1, 19–22px, weight 500)
Body / UI: Inter or system sans — everything else
Numbers / stats: tabular figures, same body font, weight 500 for the value, weight 400 / muted for the label
```
Two weights only: 400 regular, 500 medium. Never bold (700) anywhere — it fights with the dark background.

### 1.5 Spacing & radius
```
--radius-sm: 7px   /* buttons, pills, inputs */
--radius-md: 10px  /* metric cards, filter bar container */
--radius-lg: 12px  /* content cards, empty states */
Page padding: 20px
Card padding: 14px
Grid gap: 12px
```

---

## 2. The six reusable components

Every page is assembled from these. Build them once as real components (React/shadcn or equivalent in Lovable), not copy-pasted per page.

### 2.1 Page header
Always present, always in this order:
1. Breadcrumb row: back arrow (optional) + section label in accent color + `·` separator + one-line muted description of what the page does
2. Title row: icon chip (accent-tinted, 34×34px) + page title (h1) on the left; one primary action button on the right (optional — only if the page has one clear primary action, e.g. "Submit a song", "Create release")

Rule: never more than one primary (filled, accent-colored) button in the header. Secondary actions are outline/ghost style.

### 2.2 Stat strip
Optional. If present: exactly 3 or 4 metric cards in a single row, equal width, directly under the header.
- Each card: muted 11px label, then an 18–20px/500 value beneath it. No icons inside stat cards (icons live in the header/content cards, not here).
- Never partial — a page either has the full row or no stat strip at all. Don't put one metric in a sidebar (current bug: Underworld's "Live Intel" panel) while another page puts four metrics inline.

### 2.3 Tab / sub-nav bar
Optional. Pill-style tabs in a horizontal row with a bottom border under the whole bar.
- Active tab: accent-tinted background + accent text color
- Inactive tabs: muted text, no background
- Never mix tabs with underlined links or buttons in the same row (current bug: Release Manager mixes "My Releases" tab style with separate "Sales & Revenue" as a different style).

### 2.4 Filter bar
Optional, used on list/browse pages only. One horizontal bar (`--bg-surface`, bordered, `--radius-md`), containing pill-shaped sub-controls:
- Dropdowns: icon (optional) + selected value + chevron-down
- Range sliders: label + track, track fill in accent color
- Search: icon + placeholder text, flexes to fill remaining width
All sub-controls are the same height (32–36px) and sit in one row, wrapping on narrow viewports. Never scatter filters across the page width as separate labeled fields (current bug: Employment page).

### 2.5 Content card
The atomic unit for any grid of things (radio stations, jobs, shop items, releases, band members, etc.). Fixed anatomy, always in this order:
1. Top row: icon/image chip (accent-tinted, top-left) + title, with an optional small stat/rating top-right
2. 1–2 lines of metadata (muted, 11–12px) — tags/genres, then a secondary detail line (listeners, price, location, etc.)
3. Full-width action button at the bottom (filled, accent-colored, or outline if secondary)

Grid: `repeat(auto-fit, minmax(220px, 1fr))`, 12px gap. Same card component renders radio stations, shop items, job listings, festival entries, etc. — only the icon, fields, and button label change.

### 2.6 Empty state
Used any time a list/grid has zero results, OR a feature hasn't been started yet (no releases, no songs written, no active job).
- Dashed border container, `--radius-lg`, generous padding (32px vertical)
- Centered: 48px circular accent-tinted icon chip → 13px/500 headline naming the problem or opportunity → 12px muted body line explaining *why* and what to do → one action button
- Headline + body must give a reason and a next step, never just "No results" or "Nothing here yet"
- This replaces every current "0 jobs found" / "No Releases Yet" / raw config-error message (the Mapbox token error on the World Map page is a bug, not a design choice — that message should never reach players; replace with a generic "Map unavailable right now" empty state)

---

## 3. Page template (assembly order)

Every page in the game follows this exact vertical order. Sections are optional but their **order is fixed** — never reorder them page to page.

```
1. Page header              (always)
2. Stat strip                (if the page has summary metrics)
3. Tab / sub-nav bar          (if the page has sub-sections)
4. Filter bar                 (if the page is a browse/list page)
5. Content grid OR empty state (always one or the other)
```

### Top HUD bar (global, not per-page)
Applies once, in the persistent app shell, not rebuilt per page:
- Left: avatar + name + game date/location
- Right: cash (icon + value), fame (icon + value), health & energy as small circular dial gauges (not raw percentage text), notifications bell
- Health/energy dials: 30×30px ring, semantic color (red for health, green for energy), centered icon

### Left navigation (global, not per-page)
- Collapsed icon rail by default (56px wide), one icon per top-level section, tooltip on hover with the label
- Active section: accent-tinted background block behind the icon, using that section's own accent color
- Expand to full labels on hover or via a pin toggle — do not show 15–20 flat text sub-links permanently open (current bug across every screenshot)
- Sub-navigation within a section lives in the tab bar (2.3) on the page itself, not as a permanently expanded sidebar tree

---

## 4. Hard rules (apply to every page, no exceptions)

1. One accent color per top-level section, applied only to: primary buttons, active states, icon chips, progress/stat highlights. Never tint card backgrounds, borders, or body text with it.
2. One primary (filled) action button per page header. Everything else is secondary/outline/ghost.
3. Stat strips are all-or-nothing — 3 or 4 cards in a row, or omitted entirely. Never a single metric in a sidebar panel.
4. All cards in a content grid share the same anatomy (icon → title → 2 metadata lines → full-width button), regardless of what the card represents.
5. Empty states always explain *why* and give *one next action* — never a bare "no results" sentence, and never a leaked technical/config error.
6. Progress bars/meters always carry a label above and a context line below (current value / target) — never a bare colored rectangle.
7. Sentence case everywhere — no Title Case, no ALL CAPS section labels (current bug: sidebar labels are all-caps; switch to sentence case to match modern game UI conventions).
8. Two font weights only (400/500), one display face for h1 titles, body font everywhere else.
9. No more than two floating/elevated layers on screen at once (e.g. a content card + a dropdown menu) — anything deeper becomes a modal/dialog instead of stacked popovers.
10. Buttons are verb-first, sentence case, no punctuation: "Submit song", "Create release", "Clear filters" — not "Submit", "OK", or "Click here".

---

## 5. Migration order

Don't rebuild every page at once. Suggested sequence so the design system gets battle-tested on a range of page types early:

1. Build the six components (2.1–2.6) plus the global HUD and nav rail as standalone, reusable components first — before touching any existing page.
2. Migrate **Overview / Dashboard** — it has every component type (header, stat strip, content cards, empty/next-action card) and is the page players see most.
3. Migrate one **browse/list page** with filters — e.g. Employment or Radio Stations — to validate the filter bar and content grid against real data density.
4. Migrate one **empty-heavy page** — e.g. Release Manager — to validate the empty state pattern end to end.
5. Roll out to the remaining sections (Band & Live, Social, World, Admin), reusing the same six components with each section's own accent color.
6. Last: global HUD bar and nav rail polish (dial gauge animations, hover-expand sidebar), once the page-level system is consistent.

---

## 6. What to tell Lovable

When prompting Lovable to implement this, work in the same order as section 5: ask it to scaffold the six components and design tokens as a shared UI kit first, get you to approve that in isolation, then migrate pages one at a time referencing "use the PageHeader / StatStrip / FilterBar / ContentCard / EmptyState components from the shared kit" rather than describing each page's layout from scratch. This keeps Lovable from quietly drifting back to one-off layouts per page, which is the root cause of the inconsistency you have now.
