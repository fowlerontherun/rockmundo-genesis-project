-- Keep the marketing-upgrade RPC return types aligned with its declared TABLE signature.
-- labels.balance is BIGINT, so cast it explicitly to NUMERIC before returning it.

create or replace function public.upgrade_label_marketing(p_label_id uuid)
returns table(
  new_level integer,
  upgrade_cost numeric,
  effectiveness_multiplier numeric,
  weekly_budget_cap numeric,
  remaining_balance numeric
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_label public.labels%rowtype;
  v_next integer;
  v_cost numeric;
begin
  if not public._can_manage_label(p_label_id) then
    raise exception 'Not authorised to upgrade label marketing';
  end if;

  select * into v_label
  from public.labels
  where id=p_label_id
  for update;

  if not found then raise exception 'Label not found'; end if;
  if coalesce(v_label.marketing_level,1)>=10 then
    raise exception 'Marketing department is already max level';
  end if;

  v_next:=coalesce(v_label.marketing_level,1)+1;
  v_cost:=public.label_marketing_upgrade_cost(v_next);

  if coalesce(v_label.balance,0)<v_cost then
    raise exception 'Insufficient label balance for marketing upgrade';
  end if;

  update public.labels
  set balance=balance-v_cost,
      marketing_level=v_next,
      updated_at=now()
  where id=p_label_id
  returning balance into v_label.balance;

  insert into public.label_financial_transactions(
    label_id,transaction_type,amount,description
  )
  values(
    p_label_id,'expense',v_cost,
    format('Marketing department upgrade to level %s',v_next)
  );

  return query
  select
    v_next::integer,
    v_cost::numeric,
    public.label_marketing_multiplier(v_next)::numeric,
    public.label_marketing_budget_cap(v_next)::numeric,
    v_label.balance::numeric;
end;
$$;

revoke all on function public.upgrade_label_marketing(uuid) from public,anon;
grant execute on function public.upgrade_label_marketing(uuid) to authenticated;
