-- Explicitly invoked by trusted server code; no automatic payouts on deployment.
-- A single database transaction locks the claim and writes the XP event and
-- granted marker together. Rollback reverses all writes on any failure.
create or replace function public.process_skill_quest_xp_claim(p_claim_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.skill_quest_reward_claims%rowtype;
  v_def public.skill_quest_reward_definitions%rowtype;
  v_ledger_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'Only service role can process quest rewards' using errcode='42501';
  end if;

  select * into v_claim from public.skill_quest_reward_claims
  where id = p_claim_id for update;
  if not found then
    raise exception 'Unknown quest reward claim' using errcode='22023';
  end if;
  if v_claim.status = 'granted' then
    return jsonb_build_object('status','already_granted','claim_id',v_claim.id,'ledger_id',v_claim.xp_ledger_id);
  end if;
  if v_claim.status = 'processing' then
    raise exception 'Claim is marked processing; reconcile before retry' using errcode='55000';
  end if;

  select * into v_def from public.skill_quest_reward_definitions
  where quest_id = v_claim.quest_id and enabled = true;
  if not found or v_def.reward_kind <> 'xp'
    or v_claim.reward_kind <> v_def.reward_kind
    or v_claim.reward_amount <> v_def.reward_amount then
    raise exception 'Quest reward not enabled or claim amount mismatched' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.skill_quest_events e
    where e.profile_id = v_claim.profile_id
      and e.quest_id = v_claim.quest_id and e.source_type = v_def.source_type
  ) then
    raise exception 'No verified quest completion evidence' using errcode='22023';
  end if;

  -- Serialise XP updates against other progression awards using the profile lock.
  perform 1 from public.profiles where id = v_claim.profile_id for update;
  insert into public.profile_action_xp_events(profile_id,action_type,xp_amount,metadata)
  values (v_claim.profile_id,'skill_quest_reward',v_claim.reward_amount,
    jsonb_build_object('quest_id',v_claim.quest_id,'claim_id',v_claim.id,'unique_event_id',v_claim.id::text));

  -- The existing action XP trigger creates the authoritative wallet/ledger entry.
  select l.id into v_ledger_id from public.xp_ledger l
  where l.profile_id = v_claim.profile_id and l.event_type = 'skill_quest_reward'
    and l.metadata->>'claim_id' = v_claim.id::text
  order by l.created_at desc limit 1;
  if v_ledger_id is null then
    raise exception 'XP ledger entry not produced; rolling back claim' using errcode='55000';
  end if;
  update public.skill_quest_reward_claims
  set status='granted', xp_ledger_id=v_ledger_id, granted_at=now()
  where id=v_claim.id;
  return jsonb_build_object('status','granted','claim_id',v_claim.id,'ledger_id',v_ledger_id,'xp',v_claim.reward_amount);
end;
$$;
revoke all on function public.process_skill_quest_xp_claim(uuid) from public, anon, authenticated;
grant execute on function public.process_skill_quest_xp_claim(uuid) to service_role;
