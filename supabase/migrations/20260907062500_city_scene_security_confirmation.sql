-- Reassert the intended client-access boundary for city-scene state after the refinement pass.
revoke all on public.city_underground_scenes from anon, authenticated;
revoke all on public.player_city_scene_reputation from anon, authenticated;
revoke all on public.city_scene_rivalries from anon, authenticated;
grant select on public.city_underground_scenes, public.player_city_scene_reputation, public.city_scene_rivalries to authenticated;

revoke execute on function public.scene_story_award_city_rep() from public, anon, authenticated;
revoke execute on function public.track_city_scene_arrival() from public, anon, authenticated;
revoke execute on function public.get_current_city_scene(uuid) from public, anon;
revoke execute on function public.discover_scene_contacts(uuid,integer) from public, anon;
grant execute on function public.get_current_city_scene(uuid) to authenticated;
grant execute on function public.discover_scene_contacts(uuid,integer) to authenticated;
