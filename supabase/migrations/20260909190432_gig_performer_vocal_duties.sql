-- Capture both musical duties when the lineup is selected. Existing replay snapshots remain immutable.
create or replace function public.stage_performer_duties(instrument text, vocal text)
returns text language sql immutable set search_path = '' as $$
  select nullif(concat_ws(' / ', nullif(btrim(instrument), ''),
    case when lower(btrim(coalesce(vocal, ''))) not in ('', 'none', 'no vocals')
      and lower(btrim(coalesce(instrument, ''))) not like '%vocal%'
      then btrim(vocal) end), '');
$$;

create or replace function public.seed_gig_performers(p_gig_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gig public.gigs%rowtype;
  v_count integer := 0;
begin
  select * into v_gig from public.gigs where id = p_gig_id;
  if not found or coalesce(v_gig.status, '') in ('cancelled','failed') then
    return 0;
  end if;

  insert into public.gig_performers (
    gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at
  )
  select
    v_gig.id,
    v_gig.band_id,
    bm.profile_id,
    public.stage_performer_duties(coalesce(bm.instrument_role, bm.role), bm.vocal_role),
    'selected',
    now()
  from public.band_members bm
  where bm.band_id = v_gig.band_id
    and bm.profile_id is not null
    and coalesce(bm.member_status, 'active') = 'active'
    and coalesce(bm.is_touring_member, false) = false
    and (bm.joined_at is null or bm.joined_at <= coalesce(v_gig.scheduled_date, now()))
  on conflict on constraint gig_performers_unique do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only selected future lineups with an unchanged instrument can gain their missing vocal duty.
-- Completed/live gigs and canonical replay events are deliberately excluded.
update public.gig_performers gp
set role_or_instrument = public.stage_performer_duties(bm.instrument_role, bm.vocal_role)
from public.band_members bm, public.gigs g
where gp.gig_id = g.id and gp.band_id = bm.band_id and gp.profile_id = bm.profile_id
  and g.status = 'scheduled' and g.scheduled_date > now()
  and gp.lineup_status in ('selected','confirmed')
  and coalesce(bm.member_status, 'active') = 'active'
  and gp.role_or_instrument = bm.instrument_role
  and gp.role_or_instrument is distinct from public.stage_performer_duties(bm.instrument_role, bm.vocal_role);
