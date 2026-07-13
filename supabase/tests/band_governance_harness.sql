-- Static release-gate assertions for band governance schema/RPCs.
select has_table_privilege('public.band_proposals', 'select') is not null as band_proposals_exists;
select has_table_privilege('public.band_proposal_votes', 'select') is not null as band_votes_exists;
select exists (select 1 from pg_proc where proname = 'create_band_proposal') as create_rpc_exists;
select exists (select 1 from pg_proc where proname = 'cast_band_proposal_vote') as vote_rpc_exists;
select exists (select 1 from pg_indexes where indexname = 'idx_band_proposals_open_deadlines') as deadline_index_exists;
select exists (select 1 from pg_policies where tablename = 'band_proposal_votes' and policyname = 'votes privacy aware read') as hidden_vote_policy_exists;
select exists (select 1 from public.band_proposal_type_policies where proposal_type = 'change_revenue_split' and mandatory_minimum) as revenue_split_mandatory;
select exists (select 1 from public.band_proposal_type_policies where proposal_type = 'disband_band' and voting_method = 'owner_approval') as disband_owner_rule;
