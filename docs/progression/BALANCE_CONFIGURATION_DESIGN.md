# Balance Configuration Design

## Concepts
- **Balance definition:** a named set of progression and outcome parameters grouped into explicit sections: progression, attributes, practice, songwriting, recording, gigs, mastery, maintenance, teaching, band progression and achievements.
- **Balance version:** an immutable released identifier such as `progression_v2.0.0`; once active, retired or rolled back its key/config/schema cannot be changed.
- **Draft configuration:** an editable clone of a parent version. Drafts never affect gameplay and can be saved, discarded, validated, simulated and compared.
- **Validation result:** structural, mathematical and safety issues with `info`, `warning` or `critical` severity. Critical issues block approval and activation.
- **Simulation result:** deterministic scenario output for player progression, outcomes, exploit checks, sensitivity and migration impact.
- **Rollout:** approval, optional scheduling using server time, final revalidation, atomic active-version switch, cache invalidation and audit logging.
- **Rollback:** reactivation of a prior valid version for new calculations only. Historical records remain untouched.
- **Historical calculation version:** completed rewards/outcomes store the balance key and optional resolved parameter subset used by the calculation.

## Registry model
`balance_versions` stores `id`, unique `version_key`, `name`, `description`, `status`, `parent_version_id`, `config`, `schema_version`, actor timestamps and metadata. Companion tables store validation results, simulation results, rollout records and audit events.

## Typed sections
The TypeScript model in `src/balance/config.ts` defines explicit sections and runtime checks for numeric ranges, weight totals, caps, thresholds and monotonic mastery requirements. Raw arbitrary JSON is rejected by validation before approval.

## Activation policy
Only one active global version is allowed. Activation requires a valid approved or scheduled version and retires the prior active version. Cache invalidation metadata is recorded for server/client balance queries.

## Long-running activity policy
- Practice and teaching sessions use the version captured at session start.
- Songwriting projects use the version captured when the project is locked for completion.
- Recording bookings use the version captured at booking lock.
- Scheduled gigs use the version captured when the lineup/setlist is locked.
- Band goals and mastery challenges use the version captured when the milestone/challenge is started; passive recurring events use the current active version per completed event.
No single calculation may mix versions.
