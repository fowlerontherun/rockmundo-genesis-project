create or replace function public.apply_recovery_gig_outcome_penalty()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_mod jsonb;
  v_multiplier numeric:=1;
  v_withdrawal_count integer:=0;
begin
  if new.gig_id is null then return new; end if;
  if new.overall_rating is not distinct from old.overall_rating then return new; end if;

  v_mod:=public.get_gig_recovery_modifier(new.gig_id);
  v_multiplier:=coalesce((v_mod->>'modifier')::numeric,1);
  v_withdrawal_count:=coalesce((v_mod->>'withdrawalCount')::integer,0);

  if v_multiplier < 0.999 then
    new.overall_rating:=greatest(0,coalesce(new.overall_rating,0)*v_multiplier);
    new.fame_gained:=greatest(0,floor(coalesce(new.fame_gained,0)*v_multiplier)::integer);
    new.performance_details:=coalesce(new.performance_details,'{}'::jsonb) || jsonb_build_object(
      'recoveryModifier',v_multiplier,
      'withdrawalPerformers',v_withdrawal_count,
      'recoveryPenaltyApplied',true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recovery_gig_outcome_penalty on public.gig_outcomes;
create trigger trg_recovery_gig_outcome_penalty
before update of overall_rating on public.gig_outcomes
for each row execute function public.apply_recovery_gig_outcome_penalty();
