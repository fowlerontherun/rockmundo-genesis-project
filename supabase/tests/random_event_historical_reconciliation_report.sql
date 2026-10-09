-- Historical random-event reconciliation report.
-- Read-only: does NOT apply or reroll any player reward.
with profile_counts as (
  select user_id, count(*) as character_count,
    min(id) as only_character_id
  from public.profiles group by user_id
)
select pe.id as player_event_id, pe.status, pe.choice_made_at,
       re.title as event_title, re.awards_random_skill_xp,
       pe.profile_id is not null as has_character_id,
       coalesce(pc.character_count,0) as character_count,
       case
         when pe.outcome_applied then 'already_applied'
         when pe.profile_id is not null and p.id is not null then 'known_character_audit_for_prior_effects'
         when pe.profile_id is not null then 'invalid_character_ownership'
         when coalesce(pc.character_count,0)=0 then 'no_character'
         when pc.character_count=1 then 'single_character_audit_for_prior_effects'
         else 'ambiguous_multi_character_do_not_apply'
       end as reconciliation_class
from public.player_events pe
join public.random_events re on re.id=pe.event_id
left join profile_counts pc on pc.user_id=pe.user_id
left join public.profiles p on p.id=pe.profile_id and p.user_id=pe.user_id
where pe.status='awaiting_outcome'
order by reconciliation_class, pe.choice_made_at, pe.id;
