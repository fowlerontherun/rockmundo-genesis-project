# Skills & Attributes Page UX Audit

## Current information hierarchy
- The page opens with wallet/stipend information, practice restrictions, four summary cards, and then a three-tab interface.
- Tabs are currently ordered around implementation areas: Practice, Skill Tree, Attributes.
- The first actionable area is practice scheduling, so strategic progression planning is not visible until the player infers it from individual lists.

## Current tabs
- Practice Skills: lists practiceable unlocked skills and allows scheduling.
- Skill Tree: delegates to the existing tree component for unlocks and level context.
- Attributes: delegates to the attribute panel and cards.

## Duplicated information
- Wallet values appear in the wallet display and are partially echoed by summary cards.
- Practice availability appears in a page-level alert and inside the practice tab description.
- Skill category/status badges are repeated in the practice list and skill tree context.

## Missing explanations
- No role-based explanation tells players which skills matter for their current job in a band.
- Locked skills do not consistently explain whether the next action is education, activity, prerequisite levelling, or an inactive/hidden state.
- Skill effects on songwriting, recording, gigs, rehearsal, production, business, social, and wellness systems are not summarized in one place.
- Attribute cards show spend mechanics but do not provide enough before/after effect context for role decisions.

## Unclear terminology
- Players must distinguish Skill XP, Attribute Points, learned skills, and core attributes without a concise explanation.
- Raw system keys and role slugs can leak into labels when canonical display names are unavailable.
- Practice copy explains configuration values, but not why a practice choice is strategically useful.

## Mobile issues
- Existing tab cards consume substantial vertical space and start with Practice rather than overview context.
- Long prerequisite or blocked-reason strings can wrap awkwardly inside cards.
- Filter-heavy workflows need a compact layout that remains usable on narrow Android widths.

## Accessibility issues
- Icon-only actions need explicit accessible names.
- Progress bars require text equivalents for screen readers.
- Locked reasons and recommendation explanations should be readable without relying on colour or hover tooltips.
- Details panels need focus restoration and keyboard dismissal if upgraded to modal/drawer patterns.

## Poor empty states
- Practice has a helpful education link, but other sections lack specific next actions for no role, no tracked skills, no recommendations, no recent progression, and no filtered results.
- Loading states avoid zeroes in some areas but not every independent data section has a retry affordance.

## Information players must currently infer
- Which role a skill supports.
- Whether a skill is a foundation gap, specialist gap, or optional support skill.
- Which gameplay systems a skill affects.
- Which attribute improves learning speed for a skill.
- Which near-level skills are efficient next spends.
- Which locked skills are reachable now versus blocked by prerequisites.

## Progression decisions that are difficult to make
- Choosing a development focus without a band role.
- Comparing a role-relevant skill against an attribute upgrade.
- Planning toward common goals such as competent lead guitarist, producer, songwriter, engineer, frontperson, or specialist unlock.
- Understanding how a training session relates to upcoming gigs, recordings, and songwriting work.

## Current links to education and activities
- Practice empty state links to `/education` for starter lessons.
- Unlock routes exist in the catalogue metadata, but they are not consistently presented as player-facing training routes.
- Activity scheduling restrictions are queried for practice, but no concise upcoming activity context is shown on the overview.

## Current role and band context
- Canonical role links exist for skill relevance, but the page does not yet use them as an initial progression lens.
- Band membership and privacy-aware bandmate coverage need to remain backend-authoritative; the page should not expose private skill data.

## Current performance problems
- Catalogue and availability are already batched/cached through React Query, which is good.
- Filtering, recommendation scoring, and relationship joins should be memoised to avoid recalculating on every render.
- The skill tree should not be rendered until its tab is selected.

## Current analytics or telemetry
- No obvious structured Skills page telemetry is emitted from the current page.
- Useful events include page opened, focus selected, recommendation viewed/actioned, search/filter usage, detail opens, favourites, practice starts, and planner goal selection.

## Follow-up progression experience work
- Replace placeholder client-side effect copy with richer server-authoritative batched preview payloads where APIs expose them.
- Add privacy-aware band coverage once member visibility rules expose summarized role coverage.
- Expand recent progression history from a bounded ledger if/when the backend ledger is available.
- Consider a dedicated mobile filter drawer if the catalogue grows beyond the current responsive grid.
