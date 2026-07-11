# Phase 5 PR 03 — Outcome Report Rebuild

## Review recommendations before implementation

The previous `GigOutcomeReport` presented too many cards at equal priority. Overall rating, enhanced metrics, impact, fan growth, member rewards, financial cards, crowd analytics, setlist details, and technical factor cards repeated overlapping values such as fame, fans, attendance, profit, best song, chemistry, and merchandise.

Recommendations implemented:

- Put grade, verdict, attendance, crowd verdict, profit, fan gain, fame gain, best song, largest highlight, and primary actions above the fold.
- Move story information into a chronological report instead of isolated analytics cards.
- Convert setlist rows into expandable song cards so raw modifiers are hidden until requested.
- Replace performer tables with compact performer cards and avoid inventing unsupported individual weaknesses.
- Move finances, XP, rewards, chemistry, equipment, crew, skill, venue, audience, modifier, and legacy/debug information into collapsed detailed analysis.
- Add an evidence-based lessons panel generated only from DTO values.
- Preserve legacy and incomplete reports with explicit empty states instead of silently treating missing data as confirmed zero.
- Use a single-column mobile-first layout with a sticky headline and no horizontal scrolling.
- Add semantic headings, accessible timeline labels, keyboard-accessible accordions, and colour-independent status text.

## Architecture

The report now treats the Phase 5 PR 02 `GigExperienceDTO` as the preferred authoritative input. Legacy props are converted into a DTO-shaped fallback only inside the report boundary so older surfaces continue to render.

The rebuilt report is organised into three layers:

1. **Headline Result** — instant assessment and actions.
2. **Performance Story** — venue, band, setlist, timeline, song cards, performer highlights, and important moments.
3. **Detailed Analysis** — collapsed financial, technical, rewards, XP, and legacy information.

No calculations, rewards, progression, migrations, replay system, or Canvas viewer were changed.

## Information hierarchy

### Layer 1 — Headline Result

Includes grade, verdict, attendance/capacity, crowd verdict, net profit, fans gained, fame gained, best song, largest highlight, Continue, Performance Story, Detailed Analysis, and disabled Replay placeholder.

### Layer 2 — Performance Story

Includes venue, band, setlist count, modern timeline, expandable song cards, performer cards, and highlights/events presented chronologically.

### Layer 3 — Detailed Analysis

Includes financial summary, technical breakdown, rewards/XP/legacy data, warnings, and advanced statistics in collapsed accordions by default.

## Component tree

```text
GigOutcomeReport
├─ HeadlineResult
├─ PerformanceStory
│  ├─ GigTimeline
│  ├─ SongPerformanceCard
│  └─ PerformerHighlights
├─ LessonsPanel
└─ DetailedAnalysis
   ├─ FinancialSummary
   └─ TechnicalBreakdown
```

Shared helpers live in `src/components/gig/outcome/reportUtils.ts`.

## Lessons engine

The lessons engine lives in `src/components/gig/outcome/LessonsPanel.tsx` and only uses DTO evidence:

- attendance versus capacity;
- strongest and weakest song scores;
- opening song score;
- equipment quality;
- crew skill;
- band chemistry;
- existing `experience.lessons` entries.

It can recommend booking a smaller venue, rehearsing a weak song, replacing a weak opener, improving equipment, hiring crew, or increasing chemistry. It intentionally avoids recommendations when supporting values are missing.

## Timeline

The timeline is a DOM component designed as a future replay foundation. It includes doors open, crowd enters, band enters, song starts, highlight, turning point, encore, and result events with icons, colours, relative times, and current-song references. It is an ordered list with an accessible label.

## Files changed

- `src/components/gig/GigOutcomeReport.tsx`
- `src/components/gig/outcome/LessonsPanel.tsx`
- `src/components/gig/outcome/reportUtils.ts`
- `src/components/gig/GigOutcomeReport.test.tsx`
- `docs/gigs/implementation/PHASE_5_PR_03.md`
- `docs/gigs/ROCKMUNDO_LIVE_GIG_IMPLEMENTATION_ROADMAP.md`
- `docs/gigs/LIVE_GIG_SYSTEM_AUDIT.md`

## Tests

Added unit/component coverage for headline rendering, performance story, timeline, lessons, expand/collapse, legacy reports, processing state, cancelled state, mobile-safe rendering, and accessibility labels.

## Known limitations

- Performer cards do not invent individual performance grades, best moments, or weaknesses because the current DTO only exposes performer identity/role/status.
- Sponsorship and travel are shown as zero with a note because the current DTO does not expose them separately.
- Replay remains a disabled placeholder.
- Timeline events are derived presentation events, not yet server-authored replay events.

## Recommended Phase 5 PR 04

Implement server-authoritative gig timeline and completion hardening so the report timeline and future viewer/replay can consume a shared canonical event sequence rather than presentation-derived events.
