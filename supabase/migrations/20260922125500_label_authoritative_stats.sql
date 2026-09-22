-- Authoritative label management/finance summaries so UI totals do not depend on client row limits.

create or replace function public.get_label_management_stats(p_label_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with active_contracts as (
    select id,band_id from public.artist_label_contracts
    where label_id=p_label_id and status='active'
  ),
  release_stats as (
    select count(*)::integer total_releases,
           count(*) filter(where r.release_status='released')::integer released_count,
           coalesce(sum(r.total_units_sold),0)::numeric total_units,
           coalesce(sum(r.total_revenue),0)::numeric gross_release_revenue
    from public.releases r
    where r.label_contract_id in (select id from active_contracts)
      and r.release_status<>'cancelled'
  ),
  finance_stats as (
    select
      coalesce(sum(case when transaction_type in ('revenue','royalty_payment') then amount else 0 end),0)::numeric label_revenue,
      coalesce(sum(case when transaction_type in ('expense','marketing','overhead','advance','distribution') then abs(amount) else 0 end),0)::numeric total_expenses,
      coalesce(sum(case when transaction_type='marketing' then abs(amount) else 0 end),0)::numeric marketing_spend,
      coalesce(sum(case when transaction_type='advance' then abs(amount) else 0 end),0)::numeric advances_paid,
      coalesce(sum(case when transaction_type='overhead' then abs(amount) else 0 end),0)::numeric overhead
    from public.label_financial_transactions where label_id=p_label_id
  )
  select jsonb_build_object(
    'active_artists',(select count(distinct band_id) from active_contracts where band_id is not null),
    'total_releases',rs.total_releases,
    'released_count',rs.released_count,
    'total_units',rs.total_units,
    'gross_release_revenue',rs.gross_release_revenue,
    'label_revenue',fs.label_revenue,
    'total_expenses',fs.total_expenses,
    'net_profit',fs.label_revenue-fs.total_expenses,
    'marketing_spend',fs.marketing_spend,
    'advances_paid',fs.advances_paid,
    'overhead',fs.overhead,
    'staff_count',(select count(*) from public.label_staff where label_id=p_label_id)
  )
  from release_stats rs cross join finance_stats fs
$$;

revoke all on function public.get_label_management_stats(uuid) from public,anon;
grant execute on function public.get_label_management_stats(uuid) to authenticated,service_role;
