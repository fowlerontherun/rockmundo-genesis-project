-- Complete label finance authority for automated income and staff payroll.

create or replace function public.credit_label_revenue_atomic(
  p_label_id uuid,
  p_amount numeric,
  p_description text,
  p_contract_id uuid default null,
  p_recoup_amount numeric default 0
)
returns numeric language plpgsql security definer set search_path=public,pg_temp as $$
declare v_balance numeric; v_contract public.artist_label_contracts%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if p_amount<=0 then raise exception 'Revenue amount must be positive'; end if;

  update public.labels
  set balance=coalesce(balance,0)+p_amount,
      balance_went_negative_at=case when coalesce(balance,0)+p_amount<0 then balance_went_negative_at else null end,
      updated_at=now()
  where id=p_label_id
  returning balance into v_balance;
  if not found then raise exception 'Label not found'; end if;

  insert into public.label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id)
  values(p_label_id,'revenue',p_amount,p_description,p_contract_id);

  if p_contract_id is not null and p_recoup_amount>0 then
    select * into v_contract from public.artist_label_contracts where id=p_contract_id for update;
    if found then
      update public.artist_label_contracts
      set recouped_amount=least(coalesce(advance_amount,0),coalesce(recouped_amount,0)+p_recoup_amount),
          updated_at=now()
      where id=p_contract_id;
    end if;
  end if;

  return v_balance;
end $$;

revoke all on function public.credit_label_revenue_atomic(uuid,numeric,text,uuid,numeric) from public,anon,authenticated;
grant execute on function public.credit_label_revenue_atomic(uuid,numeric,text,uuid,numeric) to service_role;

create or replace function public.process_label_daily_finance()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l record; v_daily numeric; v_processed integer:=0; v_total numeric:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;

  for l in
    select lab.id,lab.balance,coalesce(sum(ls.salary_monthly),0) monthly_salary
    from public.labels lab
    left join public.label_staff ls on ls.label_id=lab.id
    where coalesce(lab.is_bankrupt,false)=false
    group by lab.id,lab.balance
    having coalesce(sum(ls.salary_monthly),0)>0
  loop
    if exists (
      select 1 from public.label_financial_transactions t
      where t.label_id=l.id and t.transaction_type='overhead'
        and t.description='Daily label staff payroll'
        and t.created_at::date=current_date
    ) then continue; end if;

    v_daily:=round(l.monthly_salary/30.0,2);
    if v_daily<=0 then continue; end if;

    update public.labels
    set balance=coalesce(balance,0)-v_daily,
        balance_went_negative_at=case when coalesce(balance,0)-v_daily<0 then coalesce(balance_went_negative_at,now()) else null end,
        updated_at=now()
    where id=l.id;

    insert into public.label_financial_transactions(label_id,transaction_type,amount,description)
    values(l.id,'overhead',v_daily,'Daily label staff payroll');

    v_processed:=v_processed+1; v_total:=v_total+v_daily;
  end loop;

  return jsonb_build_object('labels_processed',v_processed,'payroll_charged',round(v_total,2));
end $$;

revoke all on function public.process_label_daily_finance() from public,anon,authenticated;
grant execute on function public.process_label_daily_finance() to service_role;
