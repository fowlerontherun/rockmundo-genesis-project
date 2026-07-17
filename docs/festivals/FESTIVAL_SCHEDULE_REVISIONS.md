# Festival Schedule Revisions

Each edition starts with a draft revision through `ensure_festival_schedule_draft_revision`. Publishing archives any previous published revision and marks the selected draft as published. Editing after publication creates a new draft sourced from the published revision, preserving public continuity.

## States
- `draft`: editable and incomplete work is allowed.
- `ready_for_review`: editable review state.
- `published`: public schedule source.
- `locked`: normal edits are blocked; override requires authority and reason.
- `archived`: retained history.

## Behaviour
Public projections read only the latest published revision. Draft changes and unscheduled items are administrator-only. Discard/reopen/lock flows are represented in the model and audit table for follow-up workflows.
