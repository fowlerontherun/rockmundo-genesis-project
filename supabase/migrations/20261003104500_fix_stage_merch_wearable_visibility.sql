-- Stage rendering needs public cosmetic state for every requested performer, not only the caller's own profile.
-- Keep the RPC narrowly scoped to render-only fields and a bounded profile list.
create or replace function public.get_stage_merch_wearables(p_profile_ids uuid[])
returns table (
  profile_id uuid,
  design_id uuid,
  band_id uuid,
  design_name text,
  product_type text,
  artwork_url text,
  garment_color text,
  design_data jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     and coalesce((select auth.jwt()->>'role'), '') <> 'service_role'
  then
    raise exception 'Authentication required';
  end if;
  if coalesce(cardinality(p_profile_ids), 0) = 0 then return; end if;
  if cardinality(p_profile_ids) > 64 then raise exception 'Too many profiles requested'; end if;

  return query
    select w.profile_id, d.id, d.band_id, d.design_name, d.product_type, d.artwork_url,
      coalesce(nullif(d.design_data->>'garmentColor',''), nullif(d.background_color,''), '#171717'),
      d.design_data
    from public.player_merch_wearables w
    join public.tshirt_designs d on d.id=w.design_id
    where w.profile_id=any(p_profile_ids)
      and lower(coalesce(d.product_type,'')) in (
        'basic tee','graphic tee','heavyweight tee','long sleeve tee',
        'premium hoodie','zip hoodie','tour crewneck','football shirt'
      )
    order by w.profile_id;
end;
$$;

revoke all on function public.get_stage_merch_wearables(uuid[]) from public, anon;
grant execute on function public.get_stage_merch_wearables(uuid[]) to authenticated, service_role;

comment on function public.get_stage_merch_wearables(uuid[]) is
  'Returns bounded render-only equipped Merch Studio cosmetics for requested stage performers. Ownership and private inventory metadata are intentionally excluded.';
