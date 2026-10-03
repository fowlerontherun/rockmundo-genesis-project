-- Freeze Merch Studio wearables into future Top of the Pops replay snapshots.
-- Historical replays must never resolve current merch after the broadcast has been archived.
create or replace function public.totp_lock_performer_visual_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member jsonb;
  v_members jsonb := '[]'::jsonb;
  v_profile_id uuid;
  v_appearance jsonb;
  v_legacy jsonb;
  v_clothing jsonb;
  v_tattoos jsonb;
  v_merch jsonb;
  v_band_id uuid;
  v_crowd_signal jsonb;
begin
  for v_member in select value from jsonb_array_elements(coalesce(new.payload #> '{band,members}', '[]'::jsonb))
  loop
    v_profile_id := null;
    begin v_profile_id := nullif(v_member->>'profile_id','')::uuid;
    exception when invalid_text_representation then v_profile_id := null;
    end;
    v_appearance := null; v_legacy := null; v_clothing := '[]'::jsonb; v_tattoos := '[]'::jsonb; v_merch := null;

    if v_profile_id is not null then
      select psa.appearance into v_appearance from public.player_stage_appearances psa where psa.profile_id = v_profile_id limit 1;
      if v_appearance is null then
        select jsonb_build_object('gender',pac.gender,'skin_tone',pac.skin_tone,'hair_color',pac.hair_color,'height',pac.height,'shirt_color',pac.shirt_color,'pants_color',pac.pants_color,'shoes_color',pac.shoes_color)
        into v_legacy from public.player_avatar_config pac where pac.profile_id = v_profile_id limit 1;
      end if;
      select coalesce(jsonb_agg(jsonb_build_object('item',to_jsonb(aci),'selectedVariantKey',pos.selected_variant_key,'customizationConfig',coalesce(pos.customization_config,'{}'::jsonb))
        order by public.clothing_equip_slot(aci.wearable_slot,aci.category),pos.item_id),'[]'::jsonb)
      into v_clothing from public.player_owned_skins pos join public.avatar_clothing_items aci on aci.id=pos.item_id
      where pos.profile_id=v_profile_id and pos.item_type='clothing' and pos.is_equipped=true;
      select coalesce(jsonb_agg(jsonb_build_object('id',pt.id,'profile_id',pt.profile_id,'body_slot',pt.body_slot,'ink_color',pt.ink_color,'quality_score',greatest(0,least(100,pt.quality_score)),'is_infected',pt.is_infected,'category',coalesce(td.category,'custom'))
        order by pt.applied_at,pt.id),'[]'::jsonb)
      into v_tattoos from public.player_tattoos pt left join public.tattoo_designs td on td.id=pt.tattoo_design_id where pt.profile_id=v_profile_id;
      select jsonb_build_object(
        'profile_id',pmw.profile_id,'design_id',td.id,'band_id',td.band_id,'design_name',td.design_name,
        'product_type',td.product_type,'artwork_url',td.artwork_url,
        'garment_color',coalesce(nullif(td.design_data->>'garmentColor',''),nullif(td.background_color,''),'#171717'),
        'design_data',coalesce(td.design_data,'{}'::jsonb)
      ) into v_merch
      from public.player_merch_wearables pmw join public.tshirt_designs td on td.id=pmw.design_id
      where pmw.profile_id=v_profile_id limit 1;
    end if;

    v_members := v_members || jsonb_build_array(v_member || jsonb_build_object('visual_snapshot',jsonb_build_object(
      'appearance',v_appearance,'legacyAvatar',v_legacy,'richClothing',v_clothing,'tattoos',v_tattoos,'merchWearable',v_merch
    )));
  end loop;
  new.payload := jsonb_set(new.payload,'{band,members}',v_members,true);
  v_band_id := null;
  begin v_band_id := nullif(new.payload #>> '{band,id}','')::uuid;
  exception when invalid_text_representation then v_band_id := null;
  end;
  v_crowd_signal := null;
  if v_band_id is not null then
    with equipped as (
      select distinct on (td.id) td.id design_id
      from public.band_members bm
      join public.player_merch_wearables pmw on pmw.profile_id=bm.profile_id
      join public.tshirt_designs td on td.id=pmw.design_id and td.band_id=v_band_id
      where bm.band_id=v_band_id and bm.status='active'
      order by td.id,pmw.equipped_at desc
    ), products as (
      select e.design_id,pm.id merchandise_id,
        ((pm.drop_starts_at is null or pm.drop_starts_at<=now()) and (pm.available_until is null or pm.available_until>now())
          and not coalesce(pm.superfan_only,false) and (coalesce(pm.stock_quantity,0)>0 or exists(
            select 1 from public.merch_variants mv where mv.merchandise_id=pm.id and mv.is_active and coalesce(mv.stock_quantity,0)>0
          ))) on_sale
      from equipped e left join public.player_merchandise pm on pm.band_id=v_band_id and pm.custom_design_id=e.design_id
    ), sales as (
      select p.design_id,coalesce(sum(mo.quantity) filter(where mo.id is not null),0)::bigint units
      from products p left join public.merch_orders mo on mo.merchandise_id=p.merchandise_id group by p.design_id
    ), ranked as (
      select p.design_id,bool_or(coalesce(p.on_sale,false)) on_sale,s.units,max(s.units) over() max_units
      from products p join sales s using(design_id) group by p.design_id,s.units
    )
    select jsonb_build_object(
      'designId',r.design_id,
      'fameScore',least(100,round(100*ln(1+greatest(0,coalesce(b.fame,0))::numeric)/ln(1+50000000::numeric)))::integer,
      'merchPopularityScore',case when r.max_units>0 then round(100*r.units::numeric/r.max_units)::integer else 0 end,
      'onSale',r.on_sale
    ) into v_crowd_signal
    from ranked r cross join public.bands b
    where b.id=v_band_id order by r.on_sale desc,r.units desc,r.design_id limit 1;
  end if;
  new.payload := new.payload || jsonb_build_object(
    'visualSnapshotVersion',3,'visualSnapshotLockedAt',now(),'merchCrowdSignal',v_crowd_signal
  );
  new.replay_version := greatest(4,new.replay_version);
  new.checksum := md5(new.payload::text);
  return new;
end;
$$;
revoke all on function public.totp_lock_performer_visual_snapshot() from public, anon, authenticated;
comment on function public.totp_lock_performer_visual_snapshot() is
  'Freezes render-only performer appearance, clothing, tattoos and equipped Merch Studio wearable into canonical TOTP replay snapshots.';
