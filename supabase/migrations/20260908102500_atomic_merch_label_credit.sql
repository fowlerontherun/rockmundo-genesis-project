create or replace function public.credit_label_merch_revenue_atomic(
  p_label_id uuid,
  p_amount numeric,
  p_description text,
  p_related_contract_id uuid,
  p_related_band_id uuid
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_balance numeric;
  v_tx_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Label merch credit must be greater than zero';
  end if;

  update public.labels
    set balance = coalesce(balance, 0) + p_amount
  where id = p_label_id
  returning balance into v_balance;

  if not found then
    raise exception 'Label not found';
  end if;

  insert into public.label_financial_transactions(
    label_id, transaction_type, amount, description, related_contract_id, related_band_id
  ) values (
    p_label_id, 'revenue', p_amount, p_description, p_related_contract_id, p_related_band_id
  ) returning id into v_tx_id;

  return jsonb_build_object('transaction_id', v_tx_id, 'balance', v_balance, 'credited', p_amount);
end;
$$;

revoke all on function public.credit_label_merch_revenue_atomic(uuid,numeric,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.credit_label_merch_revenue_atomic(uuid,numeric,text,uuid,uuid) to service_role, postgres;
