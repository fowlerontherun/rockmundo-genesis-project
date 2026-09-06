revoke all on function public.scene_story_is_eligible(uuid,uuid,text) from authenticated,anon,public;
revoke all on function public.scene_story_snapshot(uuid) from authenticated,anon,public;
revoke all on function public.get_scene_story_opportunities(uuid,text) from anon,public;
revoke all on function public.start_scene_story(uuid,text,text) from anon,public;
revoke all on function public.resolve_scene_story_choice(uuid,uuid,text) from anon,public;

grant execute on function public.get_scene_story_opportunities(uuid,text) to authenticated;
grant execute on function public.start_scene_story(uuid,text,text) to authenticated;
grant execute on function public.resolve_scene_story_choice(uuid,uuid,text) to authenticated;
