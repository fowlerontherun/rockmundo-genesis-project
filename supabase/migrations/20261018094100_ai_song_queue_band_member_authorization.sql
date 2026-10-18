-- The player generation endpoint permits active band members, not just
-- the original writer, to generate a band recording. Match that authorization
-- here while retaining the attempt/song/user identity and service-only grants.
DO $migration$
DECLARE source_code text;
DECLARE before_text text := 'where id=p_song_id and user_id=p_user_id';
DECLARE after_text text := 'where id=p_song_id and (user_id=p_user_id or (band_id is not null and exists (select 1 from public.band_members bm where bm.band_id=public.songs.band_id and bm.user_id=p_user_id and (bm.member_status is null or bm.member_status=''active'') and bm.is_touring_member is distinct from true)))';
BEGIN
 SELECT pg_get_functiondef(to_regprocedure('public.enqueue_ai_song_generation(uuid,uuid,uuid,text,text,text)'))
 INTO source_code;
 IF source_code is null OR position(before_text in source_code)=0
 THEN RAISE EXCEPTION 'Unexpected queue enqueue definition; refusing unsafe change'; END IF;
 EXECUTE replace(source_code,before_text,after_text);
END;
$migration$;
