# Festival slot time rollout

The live owner workspace reads the edition's IANA timezone from
`festival_editions.timezone` and uses its edition ID as the draft ID.
`festival_stage_slots.start_time` and `end_time` are both `timestamptz`.
On 15 November 2026 the live upsert body matched the August compatibility
migration and ignored `p_idempotency_key`. The separate revision-table RPC in
the future-dated migration has a different contract.

Manual saves reject local times in a daylight-saving gap or repeated hour.
Pick an unambiguous start. Duration measures elapsed minutes, including when
a slot crosses midnight or a clock change. The database requires an explicit
offset for each instant and verifies the start belongs to the supplied local
festival date. The receipt is private and commits with the slot. Repeating an
identical request returns the current workspace without another write.

## Apply and verify

1. Verify the deployed owner build submits both offset-aware timestamps, the
   festival date and the unchanged retry key. Use a staging edition with the
   production stage-slot schema and capture the original RPC definition and
   execute grants before applying the reconciliation SQL in
   `supabase/reconciliation/festival/20261030_strict_festival_slot_saves.sql`.
   The SQL stops if the installed RPC body differs from the reviewed baseline.
2. Run `supabase/tests/festival_strict_slot_saves_harness.sql` against staging.
   Sign in as an organiser and save a spring-forward overnight set from
   browser contexts in Los Angeles and Tokyo. Repeat the same request key
   after discarding the first response. Verify one slot, the same slot ID,
   local start date and elapsed duration. Check that a different payload with
   the same key and a non-manager attempt fail.
3. Publish the staging edition and compare the two absolute instants and the
   festival-local times in the owner timeline, public running order, assigned
   artist calendar and settlement input. Verify no settlement is triggered by
   saving a slot. Apply to production only after the staging checks pass.

## Rollback and historic repair

Restore the captured RPC definition and grants in a transaction. Preserve the
receipt table. After reverting to an RPC that ignores retry keys, inspect the
workspace before retrying any submission with an uncertain outcome.

The reconciliation SQL never updates existing schedule rows on application.
For suspected historical problems, compare the stored instants and slot ID
with the organiser's original local programme, edition timezone, confirmed
artist booking and publication history. A mixed-timezone save cannot reliably
be identified from timestamps alone. Record the old and proposed instants for
each verified discrepancy, then review the affected artist/calendar and
settlement state before making an explicit correction through the appropriate
owner or contract workflow. Do not bulk-shift published or settled rows.
