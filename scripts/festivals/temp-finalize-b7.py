from pathlib import Path

backlog_path = Path("docs/IMPLEMENTATION_BACKLOG.md")
backlog = backlog_path.read_text()

backlog = backlog.replace(
    "## PR B6 — Festival ticket tiers, vendors and operational analytics closure\n\n**Priority:** P1  \n**Status:** PARTIAL",
    "## PR B6 — Festival ticket tiers, vendors and operational analytics closure ([#1641](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1641))\n\n**Priority:** P1  \n**Status:** COMPLETE",
    1,
)

b6_dependency = "### Dependencies\n\n- Finance Programme A and PR B4.\n\n---\n\n## PR B7"
b6_notes = """### Dependencies

- Finance Programme A and PR B4.

### Implementation notes

- PR #1641 completed the canonical ticket-tier inventory/pricing authority, vendor/stall assignment and settlement authority, operational analytics projections, and finance-ledger reconciliation required by B6.
- The backlog status was corrected here because the implementation had already merged while this consolidated document still showed `PARTIAL`.

---

## PR B7"""
if b6_dependency in backlog:
    backlog = backlog.replace(b6_dependency, b6_notes, 1)

backlog = backlog.replace(
    "## PR B7 — Festival performer collaboration, invitations and fan voting\n\n**Priority:** P2  \n**Status:** PARTIAL",
    "## PR B7 — Festival performer collaboration, invitations and fan voting\n\n**Priority:** P2  \n**Status:** COMPLETE",
    1,
)

b7_dependency = "### Dependencies\n\n- PR B1.\n\n---\n\n# Programme C"
b7_notes = """### Dependencies

- PR B1.

### Implementation notes

- Added permission-checked direct invitation projection/response flows plus explicit guest/featured performer obligations that must be accepted before a collaborator can enter canonical attendance or be attached to a setlist song.
- Added canonical rivalry objectives between booked bands. Challenges require rival acceptance and resolve only from final `festival_performance_outcomes.overall_score` evidence, never browser-supplied score modifiers.
- Added organiser-gated fan-vote windows for open unreserved canonical slots. Candidate applications are revalidated when approved and when votes are cast; vote results are advisory and cannot create contracts or reserve slots.
- Finished the repertoire-backed setlist flow with accepted guest assignment and database enforcement/preflight checks.
- Added realtime festival-booking cache invalidation for invitations, contracts, setlists, stage slots, collaborations, rivalries and fan-vote state.
- Added deduplicated lineup-change and 24-hour/2-hour performance reminders, with accepted collaborators included in recipient/readiness snapshots.
- Added B7 regression coverage for collaboration obligations, canonical rivalry evidence, fan-vote booking separation, direct-write restrictions, notifications and realtime wiring.

---

# Programme C"""
if b7_dependency not in backlog:
    raise SystemExit("B7 dependency marker not found; refusing to rewrite backlog")
backlog = backlog.replace(b7_dependency, b7_notes, 1)
backlog = backlog.replace("_Last updated: 2026-08-24_", "_Last updated: 2026-08-25_", 1)
backlog_path.write_text(backlog)

migration_path = Path(
    "supabase/migrations/20291219070000_festival_b7_collaboration_voting_closure.sql"
)
sql = migration_path.read_text()
start = sql.index(
    "CREATE OR REPLACE FUNCTION public.invite_festival_performance_collaborator("
)
end = sql.index(
    "CREATE OR REPLACE FUNCTION public.respond_festival_performance_collaborator(",
    start,
)
section = sql[start:end]
section = section.replace("  request_hash text;", "  v_request_hash text;", 1)
section = section.replace("  request_hash := public.festival_terms_hash(", "  v_request_hash := public.festival_terms_hash(", 1)
section = section.replace("collaboration.request_hash <> request_hash", "collaboration.request_hash <> v_request_hash", 1)
section = section.replace("request_hash = request_hash,", "request_hash = v_request_hash,", 1)
section = section.replace("      request_hash\n    )", "      v_request_hash\n    )", 1)
sql = sql[:start] + section + sql[end:]
migration_path.write_text(sql)

print("B7 backlog and migration finalization applied")
