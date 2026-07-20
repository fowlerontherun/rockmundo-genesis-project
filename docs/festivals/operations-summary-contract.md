# Festival operations summary contract

The secured `festival_edition_operations_summary` RPC intentionally projects slot data field-by-field rather than returning `to_jsonb(festival_stage_slots)` wholesale. The retained non-sensitive slot keys support these current consumers:

| Field | Consumers | Purpose |
| --- | --- | --- |
| `id` | Dashboard, schedule editor, lineup manager, stage management, live operations | Stable React keys and slot action targets. |
| `stage_id` | `FestivalStageManagement`, schedule editor | Groups slots under each stage. |
| `day_number` | Schedule editor, live operations | Day grouping and ordering. |
| `start_time`, `end_time` | `FestivalStageSchedule`, live operations | Timeline display. |
| `slot_type` | `FestivalStageSchedule`, lineup manager | Slot badges and booking type. |
| `status` | Dashboard, readiness, schedule editor | Confirmed/open/completed operational state. |
| `public_status` | Lineup manager, public-announcement tooling | Draft versus announced state. |
| `slot_number` | Schedule editor, drag-and-drop ordering | Stable order within a day/stage. |
| `changeover_minutes`, `changeover_duration_minutes` | `FestivalStageSchedule`, readiness | Changeover warnings and generation defaults. |
| `slot_template` | Schedule editor | Template provenance without exposing private metadata. |
| `reservation_id`, `reservation_status`, `reservation_hold_expires_at` | Schedule editor, stage management | Minimal reservation state for edit/archive affordances. |
| `soundcheck_at` | `FestivalStageSchedule`, stage management | Soundcheck timeline display. |
| `performance_session_status` | Live operations | Session readiness state. |
| `conflict_state`, `conflict_summary` | Schedule editor, readiness | Conflict warnings. |
| `stage_position` | Stage management, live operations | Non-sensitive placement metadata needed by stage tooling. |
| `system_act_id`, `system_act_name`, `system_act_status` | Dashboard, readiness, lineup manager | Occupancy and lineup display. |
| `contract_status` | Dashboard, readiness, stage management | Contracted-act counts and warnings. |

Do not expose `reservation_metadata` wholesale. New consumers must request explicit additions to this projection and document why the field is operational rather than private/commercial.
