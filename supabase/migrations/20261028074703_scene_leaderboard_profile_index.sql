-- Cover the opt-in profile FK used by profile deletion and leaderboards.
-- Small, additive index only. No scoring, consent or payout changes.
begin;
create index if not exists scene_leaderboard_opt_ins_profile
  on public.scene_leaderboard_opt_ins(profile_id);
commit;
