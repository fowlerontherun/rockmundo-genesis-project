# Band recruitment lifecycle

Band recruitment uses the existing `bands`, `band_members`, `profiles`, blocking, privacy and notification foundations instead of creating a second membership model.

## States

Vacancies move through `draft`, `open`, `paused`, `filled`, `closed`, `expired` and `cancelled`. Only `open` + `public` vacancies are discoverable by general player search; recruiters can see private and draft vacancies for their own band.

Applications move through `submitted`, `under_review`, `shortlisted`, `audition_requested`, `offer_made`, `accepted`, `rejected`, `withdrawn`, `expired` and `cancelled`. Recruiter-only notes are stored separately and are not returned to applicants.

Invitations and membership offers use a pending response state, revalidate eligibility at response time and preserve immutable history after acceptance.

## Membership acceptance behaviour

Accepted offers create rows in the existing `band_members` table transactionally. The transaction rechecks that the recipient owns the active profile, the offer is still pending and unexpired, and the player is not already an active member of the band. If the offer is linked to a vacancy, the vacancy filled count is incremented and the vacancy automatically moves to `filled` when all positions are taken.

Competing applications are retained for audit/history. Product-specific auto-withdraw behaviour can be added later without deleting existing records.

## Permissions and safety

Recruitment authority is centralized in `can_manage_band_recruitment`, which includes existing invitation managers plus active `manager` and `recruiter` band roles. RLS policies and RPCs enforce server-side access; frontend visibility is not trusted.

Blocking and privacy checks are inherited from existing invitation/application guards where invitations are used, while vacancy application RPCs prevent self-membership and duplicate active applications.
