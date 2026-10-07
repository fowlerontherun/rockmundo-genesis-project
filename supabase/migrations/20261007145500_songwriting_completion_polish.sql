-- Songwriting completion notification + one-shot final polish session.
-- Keeps the existing authoritative songwriting progression/outcome calculators
-- and adds a distinct decision point after core writing reaches 100%.

ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS writing_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS writing_quality_score integer CHECK (writing_quality_score BETWEEN 0 AND 1000),
  ADD COLUMN IF NOT EXISTS completion_quality_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completion_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS polish_success_chance integer CHECK (polish_success_chance BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS polish_attempted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS polish_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS polish_succeeded boolean,
  ADD COLUMN IF NOT EXISTS polish_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS polish_session_id uuid;

CREATE TABLE IF NOT EXISTS public.songwriting_polish_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  scheduled_end timestamptz NOT NULL,
  completed_at timestamptz,
  success_chance integer NOT NULL CHECK (success_chance BETWEEN 0 AND 100),
  success_roll integer CHECK (success_roll BETWEEN 1 AND 100),
  succeeded boolean,
  polish_gain integer NOT NULL DEFAULT 0 CHECK (polish_gain >= 0),
  quality_before integer CHECK (quality_before BETWEEN 0 AND 1000),
  quality_after integer CHECK (quality_after BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.songwriting_polish_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own songwriting polish sessions"
  ON public.songwriting_polish_sessions;
CREATE POLICY "Users view own songwriting polish sessions"
  ON public.songwriting_polish_sessions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.songwriting_polish_sessions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.songwriting_polish_sessions FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_songwriting_polish_sessions_due
  ON public.songwriting_polish_sessions(scheduled_end)
  WHERE completed_at IS NULL;

-- Calculate the writing-stage quality without creating the canonical song.
-- It mirrors complete_songwriting_project_base so the completion inbox can
-- show a real server-authoritative score before the player resolves polish.
CREATE OR REPLACE FUNCTION private.songwriting_quality_snapshot(
  p_profile_id uuid,
  p_project_id uuid,
  p_seed text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_project public.songwriting_projects%ROWTYPE;
  v_variance numeric;
  v_genre numeric := 0;
  v_genre_count integer := 0;
  v_genre_text text;
  v_craft numeric;
  v_attrs numeric;
  v_genre_score numeric;
  v_choice numeric;
  v_potential numeric;
  v_completion numeric;
  v_polish numeric;
  v_consistency numeric;
  v_final integer;
  v_breakdown jsonb;
BEGIN
  SELECT *
  INTO v_project
  FROM public.songwriting_projects
  WHERE id = p_project_id;

  IF NOT FOUND OR v_project.profile_id IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Songwriting project not found';
  END IF;

  IF v_project.genres IS NOT NULL THEN
    FOREACH v_genre_text IN ARRAY v_project.genres LOOP
      v_genre := v_genre
        + public.songwriting_skill_level(
            p_profile_id,
            public.songwriting_genre_slug(v_genre_text)
          );
      v_genre_count := v_genre_count + 1;
    END LOOP;
  END IF;

  IF v_genre_count > 0 THEN
    v_genre := v_genre / v_genre_count;
  END IF;

  v_craft := (
    public.songwriting_skill_level(p_profile_id, 'songwriting') * .34
    + public.songwriting_skill_level(p_profile_id, 'composition') * .24
    + public.songwriting_skill_level(p_profile_id, 'technical') * .10
    + v_genre * .17
    + GREATEST(
        public.songwriting_skill_level(p_profile_id, 'guitar'),
        public.songwriting_skill_level(p_profile_id, 'bass'),
        public.songwriting_skill_level(p_profile_id, 'drums'),
        public.songwriting_skill_level(p_profile_id, 'vocals')
      ) * .15
  ) * 4.8;

  v_attrs := (
    public.songwriting_attribute_value(p_profile_id, 'creative_insight') * .22
    + public.songwriting_attribute_value(p_profile_id, 'musical_ability') * .20
    + public.songwriting_attribute_value(p_profile_id, 'musicality') * .18
    + public.songwriting_attribute_value(p_profile_id, 'mental_focus') * .16
    + public.songwriting_attribute_value(p_profile_id, 'rhythm_sense') * .08
    + public.songwriting_attribute_value(p_profile_id, 'vocal_talent') * .03
    + public.songwriting_attribute_value(p_profile_id, 'technical_mastery') * .05
  ) * 2.0;

  v_genre_score := GREATEST(
    40,
    LEAST(150, (v_genre - 20) * 1.25 + 75)
  );

  v_choice := CASE
    WHEN v_project.mode = 'experimental' THEN 95
    WHEN v_project.mode = 'commercial' THEN 80
    ELSE 70
  END
  + (
      COALESCE(
        (
          SELECT difficulty
          FROM public.chord_progressions
          WHERE id = v_project.chord_progression_id
        ),
        3
      ) - 3
    ) * 10;

  v_variance := public.songwriting_seeded_variance(
    COALESCE(NULLIF(p_seed, ''), p_project_id::text),
    CASE
      WHEN v_project.mode = 'experimental' THEN .07
      WHEN v_project.mode = 'commercial' THEN .03
      ELSE .045
    END
    * (
      1 - LEAST(
        .35,
        COALESCE(v_project.consistency_score, 0)::numeric / 2000
      )
    )
  );

  v_potential := GREATEST(
    0,
    LEAST(
      1000,
      (v_craft + v_attrs + v_genre_score + v_choice + 45) * (1 + v_variance)
    )
  );
  v_completion := LEAST(
    COALESCE(v_project.music_progress, 0),
    COALESCE(v_project.lyrics_progress, 0)
  )::numeric / 2000;
  v_polish := GREATEST(
    .88,
    LEAST(1.10, .88 + COALESCE(v_project.polish_progress, 0)::numeric / 2500)
  );
  v_consistency := GREATEST(
    .90,
    LEAST(
      1.08,
      .90 + COALESCE(v_project.consistency_score, 0)::numeric / 3000
    )
  );
  v_final := round(
    GREATEST(
      0,
      LEAST(
        1000,
        v_potential
        * (.35 + v_completion * .65)
        * v_polish
        * v_consistency
      )
    )
  );

  v_breakdown := jsonb_build_object(
    'balance_version', 'songwriting_progression_v2',
    'craft', round(v_craft),
    'attributes', round(v_attrs),
    'genre', round(v_genre_score),
    'project_choices', round(v_choice),
    'collaboration', 45,
    'variance', v_variance,
    'potential', round(v_potential),
    'completion_factor', v_completion,
    'polish_factor', v_polish,
    'consistency_factor', v_consistency,
    'final_score', v_final
  );

  RETURN jsonb_build_object(
    'final_score', v_final,
    'breakdown', v_breakdown
  );
END;
$$;

REVOKE ALL ON FUNCTION private.songwriting_quality_snapshot(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

-- Whenever either the manual RPC or timed auto-completer moves a project into
-- completed state, snapshot the writing quality/chance and deliver one inbox
-- item with the real completed-session time breakdown.
CREATE OR REPLACE FUNCTION private.prepare_songwriting_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_profile_id uuid;
  v_seed text;
  v_chance integer;
  v_snapshot jsonb;
  v_quality integer;
  v_total_hours numeric := 0;
  v_total_sessions integer := 0;
  v_time_breakdown jsonb := '{}'::jsonb;
  v_time_text text := '';
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed'
     OR OLD.status IS NOT DISTINCT FROM 'completed'
     OR NEW.song_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_profile_id := NEW.profile_id;
  IF v_profile_id IS NULL THEN
    SELECT id
    INTO v_profile_id
    FROM public.profiles
    WHERE user_id = NEW.user_id
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_seed := COALESCE(
    NULLIF(NEW.random_seed, ''),
    encode(gen_random_bytes(12), 'hex')
  );
  v_chance := COALESCE(
    NEW.polish_success_chance,
    25 + floor(random() * 51)::integer
  );
  v_snapshot := private.songwriting_quality_snapshot(
    v_profile_id,
    NEW.id,
    v_seed
  );
  v_quality := COALESCE((v_snapshot->>'final_score')::integer, 0);

  SELECT
    COALESCE(sum(s.hours), 0),
    COALESCE(sum(s.session_count), 0),
    COALESCE(
      jsonb_object_agg(
        s.session_type,
        jsonb_build_object(
          'sessions', s.session_count,
          'hours', s.hours
        )
      ),
      '{}'::jsonb
    ),
    COALESCE(
      string_agg(
        initcap(replace(s.session_type, '_', ' '))
          || ' '
          || trim(to_char(s.hours, 'FM999990D##'))
          || 'h',
        ', '
        ORDER BY s.session_type
      ),
      ''
    )
  INTO
    v_total_hours,
    v_total_sessions,
    v_time_breakdown,
    v_time_text
  FROM (
    SELECT
      COALESCE(session_type, 'balanced') AS session_type,
      count(*)::integer AS session_count,
      sum(COALESCE(effort_hours, 1))::numeric AS hours
    FROM public.songwriting_sessions
    WHERE project_id = NEW.id
      AND completed_at IS NOT NULL
    GROUP BY COALESCE(session_type, 'balanced')
  ) s;

  UPDATE public.songwriting_projects
  SET
    profile_id = COALESCE(profile_id, v_profile_id),
    writing_completed_at = COALESCE(
      writing_completed_at,
      timezone('utc', now())
    ),
    writing_quality_score = v_quality,
    completion_quality_breakdown = COALESCE(
      v_snapshot->'breakdown',
      '{}'::jsonb
    ),
    random_seed = COALESCE(NULLIF(random_seed, ''), v_seed),
    polish_success_chance = v_chance,
    updated_at = timezone('utc', now())
  WHERE id = NEW.id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_inbox
    WHERE user_id = NEW.user_id
      AND related_entity_type = 'songwriting_project'
      AND related_entity_id = NEW.id
      AND metadata->>'source' = 'songwriting_completion'
  ) THEN
    INSERT INTO public.player_inbox(
      user_id,
      category,
      priority,
      title,
      message,
      metadata,
      action_type,
      action_data,
      related_entity_type,
      related_entity_id
    )
    VALUES (
      NEW.user_id,
      'system'::public.inbox_category,
      'normal'::public.inbox_priority,
      'Songwriting complete: ' || COALESCE(NEW.title, 'Untitled'),
      'You finished "' || COALESCE(NEW.title, 'Untitled') || '". '
        || 'Writing time: '
        || trim(to_char(v_total_hours, 'FM999990D##'))
        || 'h across '
        || v_total_sessions
        || CASE WHEN v_total_sessions = 1 THEN ' session' ELSE ' sessions' END
        || CASE
             WHEN v_time_text <> '' THEN ' (' || v_time_text || '). '
             ELSE '. '
           END
        || 'Song quality: '
        || v_quality
        || '/1000. Final polish chance: '
        || v_chance
        || '%. Open Songwriting to use your one final polish session or keep the song as-is.',
      jsonb_build_object(
        'source', 'songwriting_completion',
        'project_id', NEW.id,
        'profile_id', v_profile_id,
        'song_quality', v_quality,
        'total_hours', v_total_hours,
        'sessions_completed', v_total_sessions,
        'time_breakdown', v_time_breakdown,
        'polish_success_chance', v_chance
      ),
      'navigate',
      jsonb_build_object(
        'route', '/songwriting',
        'project_id', NEW.id
      ),
      'songwriting_project',
      NEW.id
    );
  END IF;

  UPDATE public.songwriting_projects
  SET completion_notified_at = COALESCE(
    completion_notified_at,
    timezone('utc', now())
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_songwriting_completion()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prepare_songwriting_completion
  ON public.songwriting_projects;
CREATE TRIGGER trg_prepare_songwriting_completion
AFTER UPDATE OF status ON public.songwriting_projects
FOR EACH ROW
EXECUTE FUNCTION private.prepare_songwriting_completion();

CREATE OR REPLACE FUNCTION public.start_songwriting_polish_session(
  p_profile_id uuid,
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_project public.songwriting_projects%ROWTYPE;
  v_start timestamptz := timezone('utc', now());
  v_end timestamptz := timezone('utc', now()) + interval '1 hour';
  v_session_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_profile_id
      AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Profile ownership validation failed';
  END IF;

  SELECT *
  INTO v_project
  FROM public.songwriting_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_project.profile_id IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Songwriting project not found';
  END IF;

  IF v_project.status IS DISTINCT FROM 'completed'
     OR LEAST(v_project.music_progress, v_project.lyrics_progress) < 2000 THEN
    RAISE EXCEPTION 'Songwriting is not complete yet';
  END IF;

  IF v_project.song_id IS NOT NULL THEN
    RAISE EXCEPTION 'Song has already been created';
  END IF;

  IF v_project.polish_resolved_at IS NOT NULL
     OR v_project.polish_attempted
     OR v_project.polish_skipped THEN
    RAISE EXCEPTION 'Final polish has already been resolved';
  END IF;

  IF v_project.is_locked
     AND v_project.locked_until IS NOT NULL
     AND v_project.locked_until > v_start THEN
    RAISE EXCEPTION 'Project is already locked by an active activity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_scheduled_activities
    WHERE profile_id = p_profile_id
      AND status IN ('scheduled', 'in_progress')
      AND tstzrange(scheduled_start, scheduled_end, '[)')
        && tstzrange(v_start, v_end, '[)')
  ) THEN
    RAISE EXCEPTION 'Final polish overlaps an existing activity';
  END IF;

  INSERT INTO public.songwriting_polish_sessions(
    project_id,
    profile_id,
    user_id,
    started_at,
    scheduled_end,
    success_chance,
    quality_before
  )
  VALUES (
    p_project_id,
    p_profile_id,
    v_user,
    v_start,
    v_end,
    COALESCE(v_project.polish_success_chance, 50),
    v_project.writing_quality_score
  )
  RETURNING id INTO v_session_id;

  UPDATE public.songwriting_projects
  SET
    polish_attempted = true,
    polish_session_id = v_session_id,
    is_locked = true,
    locked_until = v_end,
    updated_at = timezone('utc', now())
  WHERE id = p_project_id;

  INSERT INTO public.player_scheduled_activities(
    user_id,
    profile_id,
    activity_type,
    scheduled_start,
    scheduled_end,
    status,
    title,
    description,
    metadata
  )
  VALUES (
    v_user,
    p_profile_id,
    'songwriting',
    v_start,
    v_end,
    'in_progress',
    'Final polish: ' || COALESCE(v_project.title, 'Untitled'),
    'One final songwriting session to polish the completed song',
    jsonb_build_object(
      'project_id', p_project_id,
      'polish_session_id', v_session_id,
      'session_type', 'polish',
      'success_chance', COALESCE(v_project.polish_success_chance, 50)
    )
  );

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'scheduled_end', v_end,
    'success_chance', COALESCE(v_project.polish_success_chance, 50),
    'quality_before', v_project.writing_quality_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_songwriting_polish_session(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_songwriting_polish_session(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.resolve_songwriting_polish_session(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_session public.songwriting_polish_sessions%ROWTYPE;
  v_project public.songwriting_projects%ROWTYPE;
  v_roll integer;
  v_succeeded boolean;
  v_gain integer := 0;
  v_before integer;
  v_after integer;
  v_seed text;
  v_snapshot jsonb;
BEGIN
  SELECT *
  INTO v_session
  FROM public.songwriting_polish_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Final polish session not found';
  END IF;

  IF v_session.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'session_id', v_session.id,
      'succeeded', v_session.succeeded,
      'success_chance', v_session.success_chance,
      'success_roll', v_session.success_roll,
      'polish_gain', v_session.polish_gain,
      'quality_before', v_session.quality_before,
      'quality_after', v_session.quality_after
    );
  END IF;

  SELECT *
  INTO v_project
  FROM public.songwriting_projects
  WHERE id = v_session.project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Songwriting project not found';
  END IF;

  v_before := COALESCE(v_project.writing_quality_score, 0);
  v_roll := 1 + floor(random() * 100)::integer;
  v_succeeded := v_roll <= v_session.success_chance;

  IF v_succeeded THEN
    v_gain := LEAST(
      GREATEST(0, 500 - COALESCE(v_project.polish_progress, 0)),
      80 + floor(random() * 121)::integer
    );
  END IF;

  UPDATE public.songwriting_projects
  SET
    polish_progress = LEAST(
      500,
      COALESCE(polish_progress, 0) + v_gain
    ),
    polish_succeeded = v_succeeded,
    polish_resolved_at = timezone('utc', now()),
    is_locked = false,
    locked_until = NULL,
    updated_at = timezone('utc', now())
  WHERE id = v_project.id;

  v_seed := COALESCE(
    NULLIF(v_project.random_seed, ''),
    v_project.id::text
  );
  v_snapshot := private.songwriting_quality_snapshot(
    v_session.profile_id,
    v_project.id,
    v_seed
  );
  v_after := COALESCE((v_snapshot->>'final_score')::integer, v_before);

  UPDATE public.songwriting_projects
  SET
    writing_quality_score = v_after,
    completion_quality_breakdown = COALESCE(
      v_snapshot->'breakdown',
      completion_quality_breakdown
    ),
    updated_at = timezone('utc', now())
  WHERE id = v_project.id;

  UPDATE public.songwriting_polish_sessions
  SET
    completed_at = timezone('utc', now()),
    success_roll = v_roll,
    succeeded = v_succeeded,
    polish_gain = v_gain,
    quality_before = v_before,
    quality_after = v_after
  WHERE id = v_session.id;

  UPDATE public.player_scheduled_activities
  SET
    status = 'completed',
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
           'completed_at', timezone('utc', now()),
           'polish_succeeded', v_succeeded,
           'success_roll', v_roll,
           'quality_after', v_after
         )
  WHERE metadata->>'polish_session_id' = v_session.id::text
    AND status IN ('scheduled', 'in_progress');

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_inbox
    WHERE user_id = v_session.user_id
      AND related_entity_type = 'songwriting_project'
      AND related_entity_id = v_project.id
      AND metadata->>'source' = 'songwriting_polish_result'
  ) THEN
    INSERT INTO public.player_inbox(
      user_id,
      category,
      priority,
      title,
      message,
      metadata,
      action_type,
      action_data,
      related_entity_type,
      related_entity_id
    )
    VALUES (
      v_session.user_id,
      'system'::public.inbox_category,
      'normal'::public.inbox_priority,
      CASE
        WHEN v_succeeded
          THEN 'Final polish worked: ' || COALESCE(v_project.title, 'Untitled')
        ELSE 'Final polish finished: ' || COALESCE(v_project.title, 'Untitled')
      END,
      CASE
        WHEN v_succeeded THEN
          'Your final polish session worked. The roll was '
          || v_roll || ' against a ' || v_session.success_chance
          || '% chance. Song quality moved from '
          || v_before || ' to ' || v_after || '/1000.'
        ELSE
          'Your final polish session did not improve the song this time. '
          || 'The roll was ' || v_roll || ' against a '
          || v_session.success_chance || '% chance. Song quality remains '
          || v_after || '/1000.'
      END,
      jsonb_build_object(
        'source', 'songwriting_polish_result',
        'project_id', v_project.id,
        'polish_session_id', v_session.id,
        'success_chance', v_session.success_chance,
        'success_roll', v_roll,
        'succeeded', v_succeeded,
        'polish_gain', v_gain,
        'quality_before', v_before,
        'quality_after', v_after
      ),
      'navigate',
      jsonb_build_object(
        'route', '/songwriting',
        'project_id', v_project.id
      ),
      'songwriting_project',
      v_project.id
    );
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'succeeded', v_succeeded,
    'success_chance', v_session.success_chance,
    'success_roll', v_roll,
    'polish_gain', v_gain,
    'quality_before', v_before,
    'quality_after', v_after
  );
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_songwriting_polish_session(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_songwriting_polish_session(
  p_profile_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session public.songwriting_polish_sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_session
  FROM public.songwriting_polish_sessions
  WHERE id = p_session_id;

  IF NOT FOUND
     OR v_session.profile_id IS DISTINCT FROM p_profile_id
     OR v_session.user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Final polish session not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_profile_id
      AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Profile ownership validation failed';
  END IF;

  IF v_session.completed_at IS NULL
     AND v_session.scheduled_end > timezone('utc', now()) THEN
    RAISE EXCEPTION 'Final polish session is still in progress';
  END IF;

  RETURN private.resolve_songwriting_polish_session(p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_songwriting_polish_session(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_songwriting_polish_session(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.skip_songwriting_polish(
  p_profile_id uuid,
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_project public.songwriting_projects%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_profile_id
      AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Profile ownership validation failed';
  END IF;

  SELECT *
  INTO v_project
  FROM public.songwriting_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_project.profile_id IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Songwriting project not found';
  END IF;

  IF v_project.status IS DISTINCT FROM 'completed'
     OR LEAST(v_project.music_progress, v_project.lyrics_progress) < 2000 THEN
    RAISE EXCEPTION 'Songwriting is not complete yet';
  END IF;

  IF v_project.song_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'song_id', v_project.song_id,
      'quality_score', v_project.writing_quality_score
    );
  END IF;

  IF v_project.polish_attempted
     AND v_project.polish_resolved_at IS NULL THEN
    RAISE EXCEPTION 'Final polish session has already started';
  END IF;

  IF v_project.polish_resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'skipped', v_project.polish_skipped,
      'succeeded', v_project.polish_succeeded,
      'quality_score', v_project.writing_quality_score
    );
  END IF;

  UPDATE public.songwriting_projects
  SET
    polish_skipped = true,
    polish_resolved_at = timezone('utc', now()),
    is_locked = false,
    locked_until = NULL,
    updated_at = timezone('utc', now())
  WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'skipped', true,
    'quality_score', v_project.writing_quality_score,
    'success_chance', v_project.polish_success_chance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.skip_songwriting_polish(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_songwriting_polish(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_complete_songwriting_polish_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_session record;
  v_completed integer := 0;
BEGIN
  FOR v_session IN
    SELECT id
    FROM public.songwriting_polish_sessions
    WHERE completed_at IS NULL
      AND scheduled_end <= timezone('utc', now())
    ORDER BY scheduled_end
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM private.resolve_songwriting_polish_session(v_session.id);
    v_completed := v_completed + 1;
  END LOOP;

  RETURN v_completed;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_complete_songwriting_polish_sessions()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_complete_songwriting_polish_sessions()
  TO service_role;

-- Require the player to explicitly resolve the one final polish choice before
-- converting a newly-completed project into a canonical song. Preserve the
-- existing clothing-bonus wrapper around the base outcome calculator.
CREATE OR REPLACE FUNCTION public.complete_songwriting_project(
  p_profile_id uuid,
  p_project_id uuid,
  p_catalog_status text DEFAULT 'private',
  p_band_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_bonus record;
  v_base_score integer;
  v_final_score integer;
  v_song_id uuid;
  v_breakdown jsonb;
  v_writing_completed_at timestamptz;
  v_polish_resolved_at timestamptz;
BEGIN
  SELECT writing_completed_at, polish_resolved_at
  INTO v_writing_completed_at, v_polish_resolved_at
  FROM public.songwriting_projects
  WHERE id = p_project_id;

  IF v_writing_completed_at IS NOT NULL
     AND v_polish_resolved_at IS NULL THEN
    RAISE EXCEPTION 'Choose the final polish session or keep the song as-is first';
  END IF;

  v_result := public.complete_songwriting_project_base(
    p_profile_id,
    p_project_id,
    p_catalog_status,
    p_band_id
  );

  IF COALESCE((v_result->>'duplicate')::boolean, false) THEN
    RETURN v_result;
  END IF;

  SELECT *
  INTO v_bonus
  FROM public.get_equipped_clothing_bonuses(p_profile_id);

  IF COALESCE(v_bonus.songwriting_pct, 0) <= 0 THEN
    RETURN v_result;
  END IF;

  v_song_id := NULLIF(v_result->>'song_id', '')::uuid;
  v_base_score := COALESCE((v_result->>'final_score')::integer, 0);
  v_final_score := LEAST(
    1000,
    round(v_base_score * (1 + v_bonus.songwriting_pct / 100.0))::integer
  );
  v_breakdown := COALESCE(v_result->'breakdown', '{}'::jsonb)
    || jsonb_build_object(
         'clothing_bonus_pct', v_bonus.songwriting_pct,
         'clothing_bonus_items', v_bonus.equipped_bonus_items,
         'pre_clothing_score', v_base_score,
         'final_score', v_final_score
       );

  UPDATE public.songs
  SET
    quality_score = v_final_score,
    song_rating = v_final_score,
    songwriting_breakdown = v_breakdown
  WHERE id = v_song_id;

  UPDATE public.songwriting_projects
  SET
    song_rating = v_final_score,
    quality_score = LEAST(100, round(v_final_score / 10.0)),
    songwriting_breakdown = v_breakdown,
    songwriting_input_snapshot = COALESCE(
      songwriting_input_snapshot,
      '{}'::jsonb
    ) || jsonb_build_object(
      'clothing_bonus_pct', v_bonus.songwriting_pct,
      'clothing_bonus_items', v_bonus.equipped_bonus_items
    ),
    updated_at = timezone('utc', now())
  WHERE id = p_project_id;

  RETURN v_result || jsonb_build_object(
    'final_score', v_final_score,
    'breakdown', v_breakdown
  );
END;
$$;

-- The base function is an implementation detail; prevent direct client RPC
-- calls from bypassing the final-polish choice or clothing wrapper.
REVOKE ALL ON FUNCTION public.complete_songwriting_project_base(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_songwriting_project(uuid, uuid, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_songwriting_project(uuid, uuid, text, uuid)
  TO authenticated, service_role;

-- Existing unconverted completed projects should gain the decision point
-- without retroactively flooding players' inboxes.
DO $$
DECLARE
  v_project record;
  v_seed text;
  v_snapshot jsonb;
BEGIN
  FOR v_project IN
    SELECT id, profile_id, random_seed, completed_at, updated_at
    FROM public.songwriting_projects
    WHERE status = 'completed'
      AND song_id IS NULL
      AND writing_completed_at IS NULL
      AND profile_id IS NOT NULL
  LOOP
    v_seed := COALESCE(
      NULLIF(v_project.random_seed, ''),
      encode(gen_random_bytes(12), 'hex')
    );
    v_snapshot := private.songwriting_quality_snapshot(
      v_project.profile_id,
      v_project.id,
      v_seed
    );

    UPDATE public.songwriting_projects
    SET
      writing_completed_at = COALESCE(
        v_project.completed_at,
        v_project.updated_at,
        timezone('utc', now())
      ),
      writing_quality_score = COALESCE(
        (v_snapshot->>'final_score')::integer,
        0
      ),
      completion_quality_breakdown = COALESCE(
        v_snapshot->'breakdown',
        '{}'::jsonb
      ),
      random_seed = v_seed,
      polish_success_chance = 25 + floor(random() * 51)::integer
    WHERE id = v_project.id;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
