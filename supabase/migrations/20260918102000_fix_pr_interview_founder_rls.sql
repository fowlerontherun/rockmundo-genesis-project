drop policy if exists "Users can update own pr_offers" on public.pr_media_offers;

create policy "Users can update own pr_offers"
on public.pr_media_offers
for update
to authenticated
using (
  auth.uid() = user_id
  or band_id in (
    select bm.band_id
    from public.band_members bm
    left join public.profiles p on p.id = bm.profile_id
    where bm.member_status = 'active'
      and lower(coalesce(bm.role, '')) in ('leader', 'founder')
      and (bm.user_id = auth.uid() or p.user_id = auth.uid())
  )
)
with check (
  auth.uid() = user_id
  or band_id in (
    select bm.band_id
    from public.band_members bm
    left join public.profiles p on p.id = bm.profile_id
    where bm.member_status = 'active'
      and lower(coalesce(bm.role, '')) in ('leader', 'founder')
      and (bm.user_id = auth.uid() or p.user_id = auth.uid())
  )
);

drop policy if exists "Users can view own pr_offers" on public.pr_media_offers;

create policy "Users can view own pr_offers"
on public.pr_media_offers
for select
to authenticated
using (
  auth.uid() = user_id
  or band_id in (
    select bm.band_id
    from public.band_members bm
    left join public.profiles p on p.id = bm.profile_id
    where bm.member_status = 'active'
      and (bm.user_id = auth.uid() or p.user_id = auth.uid())
  )
);
