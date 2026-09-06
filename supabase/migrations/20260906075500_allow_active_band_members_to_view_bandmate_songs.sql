-- Keep setlist/rehearsal song discovery consistent with the band collaboration model.
-- Active non-touring members may read unarchived songs owned by another active
-- non-touring member of the same band. Existing owner/released/band-song policies
-- remain in place; this only fills the collaboration gap for draft/member songs.

drop policy if exists "Active band members can view bandmate songs" on public.songs;

create policy "Active band members can view bandmate songs"
on public.songs
for select
to authenticated
using (
  coalesce(archived, false) = false
  and exists (
    select 1
    from public.band_members viewer_bm
    join public.band_members owner_bm
      on owner_bm.band_id = viewer_bm.band_id
    where coalesce(viewer_bm.member_status, 'active')::text = 'active'
      and coalesce(viewer_bm.is_touring_member, false) = false
      and viewer_bm.user_id = (select auth.uid())
      and coalesce(owner_bm.member_status, 'active')::text = 'active'
      and coalesce(owner_bm.is_touring_member, false) = false
      and (
        (songs.profile_id is not null and owner_bm.profile_id = songs.profile_id)
        or (
          songs.profile_id is null
          and songs.user_id is not null
          and owner_bm.user_id = songs.user_id
        )
      )
  )
);
