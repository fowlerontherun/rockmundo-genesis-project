revoke all on public.scene_story_catalog from authenticated;
revoke all on public.player_scene_story_runs from authenticated;
revoke all on public.player_scene_story_history from authenticated;

grant select on public.scene_story_catalog to authenticated;
grant select on public.player_scene_story_runs to authenticated;
grant select on public.player_scene_story_history to authenticated;
