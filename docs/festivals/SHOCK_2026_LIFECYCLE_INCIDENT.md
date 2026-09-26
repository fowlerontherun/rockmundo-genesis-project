# Shock Festival: September 2026 lifecycle incident and end-to-end repairs

## Verified production findings (26 September 2026)

Production records for the same September 26–27 Shock Festival disagree:

- `festivals` `1c0d24b5-0bb5-4852-a7e4-7ba64e5455f8`: `upcoming`.
- Legacy `festival_editions` `e8a3a7dd-596d-4c60-82ec-bfb06423f52e`: `planning`.
- Canonical company `3f7b70f6-7b1e-43e9-b890-a2d65164285a` and `festival_editions_v2` `1360260f-c1b2-4335-8cbe-f96338534eba`: already `completed`.
- Runtime `11c408b0-d00f-42b6-9745-897ec65745a9` was created and completed at 06:02:25 UTC on September 26, the **first day** of the two-day event.
- Public launch `shock-festival` remains `tickets_on_sale`, with 9 paid admission tickets out of 1,200 allocated.
- Simplified results claim 1,069 admitted against 1,114 forecast. These are simulated forecast-based results, not 1,069 verified paid attendees.
- The generated eight-slot schedule consists of six generic NPC Festival Act placeholders plus Shockmaster and WAR DOGS (both billed as support); no headliner is recorded.
- The simplified result already has a posted company transaction and a frozen finance ledger, but attendee engagement finalisation is null.
- No corresponding rich `festival_results` row or canonical `festival_edition_settlements` row was found for this edition.

## Immediate safety repair (this change)

The simplified Run Festival function currently creates an already-completed runtime, simulated weather, forecast admissions and a completion digest, and the simplified result trigger posts settlement immediately. This change prevents that final-result shortcut from running until after the last Festival day in the city timezone. This is a *finalisation guard*, not a claim that minute-by-minute gameplay is implemented.

The public Festival page now identifies the date phase separately from ticket-sale status; its countdown is not shown as an opening countdown once the Festival date has started. The change does not mutate Shock's already-applied transaction, force another run, rewrite paid sales, or silently relabel simulation as real-world ticket attendance.

## Required follow-on architecture and acceptance gates

1. **One annual edition ID:** resolve the public launch, owner console, booking records, stage timetable, attendee experience, results and historical URLs to the canonical company edition. Legacy IDs remain read-only compatibility aliases with explicit migration provenance.
2. **Separate event and commercial statuses:** tickets may be on sale while an event is upcoming; then pre-show, gates open, day-by-day live, closing, reconciliation, published final, and archived. Do not derive one from the other.
3. **One published line-up and schedule:** start with confirmed artist booking IDs and explicit billing positions. Timetables by day and stage show only published slots. Do not inject anonymous "NPC Festival Act" placeholders into public results or silently mark confirmed acts as support/headliners.
4. **Distinct audience measurements:** display paid admission tickets, complimentary tickets, genuine check-ins, estimated fans, peak occupancy and forecast separately. Attendance simulation and audience satisfaction must cite their inputs and versions. Paid admissions and refunds must not be overwritten by forecast.
5. **Live player and organiser home:** public Festival detail shows current day, active/next stages, actual checked-in count when available, changes/delays, and ways to attend or watch. Owner console shows remaining schedule, staff readiness, incidents and financial obligations; neither should prematurely display archived results.
6. **Performance-to-outcome pipeline:** the canonical performance/session outcome should feed festival highlights, band XP/fame/fans, relevant crew XP and gig history once, tied to the frozen runtime digest, never directly from client-submitted outcomes.
7. **Final closing and idempotent reconciliation:** close the last day and clear gates; reconcile attendance, refunds, contracts, performance effects, sponsor outcomes, merchandising and company finance before marking final results public. Retry/recovery is idempotent across payment/effects tables.
8. **Shock preservation:** do not delete or replay the settled Shock result/transaction. An operator-reviewed reconciliation must explicitly select whether to annotate it as an early simulated historical result, suppress its public display until the festival has ended, and attach verified ticket/booking/engagement data without reposting money.
9. **Regression suite:** cover before start, first and middle day, after last local day including DST, sell-out/refund flows, zero or partial confirmed acts, player billing and NPC fill, historical/legacy redirects, duplicate Run clicks, retry-safe settlement and owner/public projection consistency.

Do not promote this migration without verifying the database readiness helper shape and CI/runtime harness results. The existing production Shock result requires a separate audited repair rather than a destructive migration.
