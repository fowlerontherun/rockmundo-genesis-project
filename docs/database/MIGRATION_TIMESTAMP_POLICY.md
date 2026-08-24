# Migration timestamp policy

New migrations normally use a valid UTC timestamp no more than two days ahead of the
repository clock. The Festival programme is the sole established exception: its
already-deployed, contiguous `20291217`–`20291218` sequence is a logical migration
namespace. Corrections to that sequence must be forward-only, lexically later than
the migration they repair, and use the next unused time in that namespace. Existing
Festival migration files are immutable.

The canonical verifier recognises the namespace rather than adding individual
expected failures. `20291218100000_festival_settlement_v3_forward_corrections.sql`
is therefore the forward successor to `20291218090000_native_festival_settlement_execution.sql`.

## Corrected non-Festival filenames

The unrelated June–November migrations that were accidentally prefixed with `2029`
use their intended `2025` timestamps. Exact filename references and the frozen
collision registry must use those corrected identities. The remaining `2029`
filenames belong only to the deployed December Festival namespace described above;
they cannot be renamed without reconciling every deployed migration ledger first.
