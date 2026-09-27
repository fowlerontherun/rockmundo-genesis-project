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

Leaders, founders, co-leaders, managers and recruiters can invite existing friends **or** any publicly discoverable active character from **Band → Members → Invite Player**. The dialog reuses `searchPublicProfiles` (username/character search), offers a quick friend picker, allows a performance role, optional vocals and message, and shows pending invitations with cancellation. Search results flag existing members, pending recipients and the inviter's own characters. Other band names are informational: only the server can distinguish active from hiatus memberships and decide whether another invitation is allowed.

Recipients review and accept or decline invitations on `/band/members` whether or not they already belong to a band. New notification action links and legacy `/band-manager` invitation links are normalized to that live route. If the original band no longer exists, recipients can still decline the pending invitation.

Invitations still go through the existing `send_band_invitation` RPC; a search result does not grant permission. Its `can_receive_band_invitation` helper permits non-friends only if the character's profile is public and band invitations are allowed. Friends retain their existing invitation access. Blocking, own-account exclusion, capacity, active membership and invitation response checks remain enforced on the server. Where the optional privacy table is not installed, active, unblocked characters are treated as publicly discoverable, consistent with the existing public player search.

Blocking and privacy checks are inherited from existing invitation/application guards where invitations are used, while vacancy application RPCs prevent self-membership and duplicate active applications.
