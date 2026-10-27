-- Small indexes for the newly deployed City Scene tables.
-- Advisor findings: unindexed foreign keys in objectives and XP claim/receipt tables.
-- These tables are tiny at launch; index creation is safe in this migration.
begin;
create index if not exists scene_challenge_objectives_template
  on public.scene_challenge_objectives(template_id);
create index if not exists scene_reward_claims_cycle
  on public.scene_reward_claims(cycle_id);
create index if not exists scene_reward_claims_profile
  on public.scene_reward_claims(profile_id);
create index if not exists scene_reward_grant_receipts_profile
  on public.scene_reward_grant_receipts(profile_id);
commit;