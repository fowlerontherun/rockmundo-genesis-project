# Festival settlement implementation audit

This audit reviews the merged PR #1200 outcome model and PR #1211 operations model before enabling irreversible settlement.

## Input classification

| Input | Classification | Settlement decision |
| --- | --- | --- |
| `festival_performance_outcomes` | Authoritative once `status = finalised`; unsafe while calculated/invalidated | Settlement rejects non-finalised rows and invalidated rows without replacement. |
| `festival_song_performance_outcomes` | Derived authoritative evidence from finalised performance outcome | Locked into the settlement snapshot for familiarity, streaming and song-discovery decisions. |
| `festival_performance_effects` | Pending | Effects are proposals only. Settlement validates source outcome, model version, status and caps before recording an application result. |
| `festival_fan_conversion_outcomes` | Pending | Converted into auditable fan-conversion applications exactly once. |
| Outcome finalisation | Authoritative gate | Settlement requires every included outcome to be finalised. |
| Outcome invalidation/replacement | Blocked if incomplete | Invalidated outcomes must be superseded before settlement can lock. |
| Model/config versions | Authoritative metadata | Settlement stores `calculation_config_version` and rejects unsupported effect sources through application records. |
| Contract terms snapshots | Duplicated | Contract rows are compatibility/current snapshots; signed versions are preferred. |
| `festival_contract_versions` | Authoritative | Contract instructions derive from the signed/current version captured in the lock snapshot. |
| `festival_contract_signatures` | Authoritative | Included in the lock snapshot to prove signed terms. |
| Cancellation terms/evidence | Partially missing | Contract status/reason exists, but detailed incident/insurance mitigation remains represented as blocked calculation detail where evidence is absent. |
| Reservations/stage slots | Authoritative for schedule attribution | Snapshot includes session/contract links and slot-derived terminal state. |
| Performance-session completion | Authoritative terminal evidence | Non-terminal sessions block readiness. |
| Settlement-pending markers | Derived | Readiness warnings identify pending effects; the settlement migration creates explicit settlement records. |
| Edition operational ledger | Authoritative finance ledger | Settlement reconciles existing ledger entries and blocks currency mismatch. |
| Staff wage obligations | Authoritative once posted to operations ledger | Reconciled rather than recreated. |
| Permit obligations | Authoritative once posted to operations ledger | Reconciled rather than duplicated. |
| Insurance obligations | Authoritative policy/ledger evidence | Reconciled; claims are instructions unless an economy rule permits automatic credit. |
| System-act costs | Authoritative when stored as operations entries | Settlement does not invent new system-act costs. |
| Settlement-readiness RPC | Derived gate | Used as the first server-side check, then reinforced by settlement-specific checks. |
| Legacy migration records | Legacy-only unless mapped | Open critical/blocker migration issues block readiness. |
| Data-health blockers | Blocked | Open critical/blocker issues stop settlement without an admin override reason. |

## Corrective migration

`20291213090000_festival_effects_and_settlement.sql` adds explicit settlement status, immutable settlement snapshots, application records, contract instructions, financial results, reconciliation, source locks and batch idempotency. It intentionally reuses pending outcome/effect rows rather than recalculating audience or final performance outcomes.
