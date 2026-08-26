# Verification

The failure signature for this issue is that the Festival edition shell and company-edition RPCs succeed, while no request is emitted for `get_festival_edition_artist_programme` or `get_festival_edition_ticket_plan`. The shared projection repository now binds the Supabase `rpc` method before invoking it, so these calls can reach the backend.
