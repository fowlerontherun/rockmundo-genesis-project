# Band relationship progression foundation

Existing inspection found an older band-level chemistry model: `bands.chemistry_level`, `bands.cohesion_score`, `bands.days_together`, `bands.last_chemistry_update`, member `chemistry_contribution`, and `band_chemistry_events`. This PR preserves those values as compatibility summaries. New pairwise relationship rows are the source of truth, and `recalculate_band_chemistry` writes derived snapshots back to the legacy band summary fields for older gig, rehearsal and dashboard code.

Relationship dimensions are separate: familiarity, trust, creative chemistry, performance chemistry, reliability confidence, social rapport and conflict. Relationship level is derived from the weighted dimensions and gated by trust/conflict so one exceptional stat cannot hide severe problems.

Band cohesion formula v1: `58% average pair strength + 27% weakest significant pairing + participation/band-size adjustment - conflict pressure`. This prevents a simple average from hiding one severe weak link.

Event impacts live in `relationship_balance_config` and in the TypeScript balancing mirror. Source type, source id, event type and pair create an idempotency key so activity retries cannot duplicate gains. Positive repeated activities use diminishing returns; negative severe events remain meaningful. Caps limit chemistry gameplay effects to ±10% rehearsal/songwriting, ±8% performance/recording and ±10% tour stress resistance.

Decay defaults are gentle: familiarity does not decay, trust only decays after prolonged inactivity, creative/live chemistry decay slowly after inactivity, and conflict decays slowly when no new incidents occur. Severe moderation/safety incidents remain out of scope for gameplay-only conflict.
