-- Final effective SQL after the verified fix 20261014_songwriting_completion_inbox_format_fix.
-- Future songwriting completion inbox signal, idempotent and non-retroactive.
-- The AFTER status trigger runs only on a transition into 'completed'.
CREATE UNIQUE INDEX IF NOT EXISTS player_inbox_songwriting_completion_once
 ON public.player_inbox(related_entity_id)
 WHERE related_entity_type='songwriting_project'
   AND metadata->>'source'='songwriting_completion';

CREATE OR REPLACE FUNCTION private.rockmundo_notify_songwriting_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_hours numeric;v_sessions integer;v_score integer;
BEGIN
 IF NEW.status IS DISTINCT FROM 'completed'
    OR OLD.status IS NOT DISTINCT FROM 'completed'
    OR NEW.profile_id IS NULL THEN
  RETURN NEW;
 END IF;
 SELECT coalesce(sum(coalesce(s.effort_hours,1)),0),count(*)::integer
 INTO v_hours,v_sessions
 FROM public.songwriting_sessions s
 WHERE s.project_id=NEW.id AND (s.completed_at IS NOT NULL OR s.session_end IS NOT NULL);
 v_score:=least(1000,greatest(0,coalesce(NEW.writing_quality_score,NEW.quality_score,50)));

 INSERT INTO public.player_inbox(
   user_id,category,priority,title,message,metadata,
   action_type,action_data,related_entity_type,related_entity_id
 )
 VALUES(
   NEW.user_id,'system'::public.inbox_category,'normal'::public.inbox_priority,
   'Songwriting complete: '||coalesce(NEW.title,'Untitled'),
   format('Your song is ready to review. Writing quality: %s/1000 across %s sessions (%s hours). Choose the one-hour final polish or keep the song as-is.',
     v_score,v_sessions,trim(to_char(v_hours,'FM9999990.0'))),
   jsonb_build_object('source','songwriting_completion',
     'project_id',NEW.id,'profile_id',NEW.profile_id,
     'writing_quality_score',v_score,
     'success_chance',NEW.polish_success_chance,
     'total_sessions',v_sessions,'total_hours',v_hours),
   'navigate',jsonb_build_object('route','/songwriting','project_id',NEW.id),
   'songwriting_project',NEW.id
 )
 ON CONFLICT DO NOTHING;

 UPDATE public.songwriting_projects p
 SET completion_notified_at=coalesce(p.completion_notified_at,now())
 WHERE p.id=NEW.id AND p.completion_notified_at IS NULL;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.rockmundo_notify_songwriting_completion()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS rockmundo_songwriting_completion_inbox
 ON public.songwriting_projects;
CREATE TRIGGER rockmundo_songwriting_completion_inbox
 AFTER UPDATE OF status ON public.songwriting_projects
 FOR EACH ROW EXECUTE FUNCTION private.rockmundo_notify_songwriting_completion();
NOTIFY pgrst,'reload schema';