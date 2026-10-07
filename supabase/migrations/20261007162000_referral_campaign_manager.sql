create table if not exists public.referral_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  name text not null check (char_length(name) between 1 and 80),
  referral_code text not null,
  source text not null default 'referral_hub',
  partner_name text,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
alter table public.referral_campaigns enable row level security;
revoke all on table public.referral_campaigns from anon, authenticated;
create or replace function public.admin_list_referral_campaigns() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role::text='admin') then raise exception 'Admin access required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.referral_campaigns c),'[]'::jsonb);
end; $$;
create or replace function public.admin_save_referral_campaign(p_id uuid,p_slug text,p_name text,p_referral_code text,p_source text,p_partner_name text,p_notes text,p_starts_at timestamptz,p_ends_at timestamptz,p_is_active boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.referral_campaigns;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role::text='admin') then raise exception 'Admin access required'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then raise exception 'Invalid campaign slug'; end if;
  if p_referral_code !~ '^RM[A-Z0-9]{6,18}$' then raise exception 'Invalid referral code'; end if;
  if p_source not in ('referral_hub','band_recruitment','gig_share','song_chart_share','release_chart_share','achievement_share') then raise exception 'Invalid source'; end if;
  if not exists (select 1 from public.referral_codes rc where rc.code=p_referral_code) then raise exception 'Referral code not found'; end if;
  if p_id is null then
    insert into public.referral_campaigns(slug,name,referral_code,source,partner_name,notes,starts_at,ends_at,is_active,created_by) values(p_slug,trim(p_name),p_referral_code,p_source,nullif(trim(p_partner_name),''),nullif(trim(p_notes),''),p_starts_at,p_ends_at,coalesce(p_is_active,true),auth.uid()) returning * into v;
  else
    update public.referral_campaigns set slug=p_slug,name=trim(p_name),referral_code=p_referral_code,source=p_source,partner_name=nullif(trim(p_partner_name),''),notes=nullif(trim(p_notes),''),starts_at=p_starts_at,ends_at=p_ends_at,is_active=coalesce(p_is_active,true),updated_at=now() where id=p_id returning * into v;
    if v.id is null then raise exception 'Campaign not found'; end if;
  end if;
  return to_jsonb(v);
end; $$;
revoke execute on function public.admin_list_referral_campaigns() from public,anon;
revoke execute on function public.admin_save_referral_campaign(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean) from public,anon;
grant execute on function public.admin_list_referral_campaigns() to authenticated;
grant execute on function public.admin_save_referral_campaign(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean) to authenticated;