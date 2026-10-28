-- Protect band supporter consent when the authoritative band leader changes.
-- A previous leader's opt-in MUST NOT survive transfer of leadership.
-- This is an additive, fail-closed privacy guard; scoring/rewards unaffected.
begin;

create or replace function private.revoke_scene_band_consent_on_leader_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.leader_id is distinct from old.leader_id then
    update public.scene_band_leaderboard_opt_ins
       set enabled = false,
           updated_by_account = null,
           updated_at = now()
     where band_id = new.id and enabled is true;
  end if;
  return new;
end;
$$;

-- The band governance guard remains in place. This after-trigger runs only
-- for transfers already authorised by the canonical leadership RPC.
drop trigger if exists scene_band_leader_consent_revocation on public.bands;
create trigger scene_band_leader_consent_revocation
after update of leader_id on public.bands
for each row
when (new.leader_id is distinct from old.leader_id)
execute function private.revoke_scene_band_consent_on_leader_change();

-- Reconcile any already-stale consent which preceded this trigger. A missing
-- current leader profile is also treated as absent consent, never published.
update public.scene_band_leaderboard_opt_ins opt
   set enabled = false,
       updated_by_account = null,
       updated_at = now()
 where opt.enabled is true
   and not exists (
     select 1
       from public.bands b
       join public.profiles leader on leader.id = b.leader_id
      where b.id = opt.band_id
        and leader.user_id = opt.updated_by_account
   );

-- No browser RPC or table permissions are introduced.
revoke all on function private.revoke_scene_band_consent_on_leader_change()
  from public, anon, authenticated;

commit;
