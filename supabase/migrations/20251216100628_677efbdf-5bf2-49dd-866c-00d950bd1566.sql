-- Fix remaining function search paths (WARN-level issues)

CREATE OR REPLACE FUNCTION public.check_setlist_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM setlists WHERE band_id = NEW.band_id AND is_active = true) >= 3 THEN
    RAISE EXCEPTION 'Band can only have 3 active setlists';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_twaat_metrics_from_reaction()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reaction_type = 'like' THEN
      UPDATE twaat_metrics SET likes = likes + 1, updated_at = now() WHERE twaat_id = NEW.twaat_id;
    ELSIF NEW.reaction_type = 'retwaat' THEN
      UPDATE twaat_metrics SET retwaats = retwaats + 1, updated_at = now() WHERE twaat_id = NEW.twaat_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reaction_type = 'like' THEN
      UPDATE twaat_metrics SET likes = GREATEST(0, likes - 1), updated_at = now() WHERE twaat_id = OLD.twaat_id;
    ELSIF OLD.reaction_type = 'retwaat' THEN
      UPDATE twaat_metrics SET retwaats = GREATEST(0, retwaats - 1), updated_at = now() WHERE twaat_id = OLD.twaat_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_page_graphics_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_twaat_reply_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE twaat_metrics SET replies = replies + 1, updated_at = now() WHERE twaat_id = NEW.parent_twaat_id;
  ELSIF TG_OP = 'DELETE' AND OLD.deleted_at IS NULL THEN
    UPDATE twaat_metrics SET replies = GREATEST(0, replies - 1), updated_at = now() WHERE twaat_id = OLD.parent_twaat_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_setlist_total_duration(p_setlist_id uuid)
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE total_seconds INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)
  INTO total_seconds
  FROM setlist_songs ss JOIN songs s ON s.id = ss.song_id
  WHERE ss.setlist_id = p_setlist_id;
  RETURN total_seconds;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_follower_counts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE twaater_accounts SET following_count = following_count + 1 WHERE id = NEW.follower_account_id;
    UPDATE twaater_accounts SET follower_count = follower_count + 1 WHERE id = NEW.followed_account_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE twaater_accounts SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_account_id;
    UPDATE twaater_accounts SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.followed_account_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_university_attendance_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF NOT NEW.was_locked_out THEN
    INSERT INTO activity_feed (user_id, activity_type, message, metadata, earnings)
    SELECT pue.user_id, 'university_attendance',
      'Attended class at ' || u.name || ' - earned ' || NEW.xp_earned || ' XP',
      jsonb_build_object('enrollment_id', pue.id, 'university_id', u.id, 'university_name', u.name, 'course_id', uc.id, 'course_name', uc.name, 'xp_earned', NEW.xp_earned),
      NEW.xp_earned
    FROM player_university_enrollments pue
    JOIN universities u ON u.id = pue.university_id
    JOIN university_courses uc ON uc.id = pue.course_id
    WHERE pue.id = NEW.enrollment_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_rehearsal_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.rehearsal_stage := CASE
    WHEN NEW.familiarity_minutes >= 1800 THEN 'perfected'
    WHEN NEW.familiarity_minutes >= 900 THEN 'well_rehearsed'
    WHEN NEW.familiarity_minutes >= 300 THEN 'familiar'
    WHEN NEW.familiarity_minutes >= 60 THEN 'learning'
    ELSE 'unlearned'
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_band_song_familiarity_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_old_gig_offers()
RETURNS void LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  UPDATE gig_offers SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_venue_relationship()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF NEW.status = 'completed' AND NEW.band_id IS NOT NULL AND NEW.venue_id IS NOT NULL THEN
    INSERT INTO venue_relationships (band_id, venue_id, gigs_performed, last_performance_date, loyalty_points)
    VALUES (NEW.band_id, NEW.venue_id, 1, NEW.completed_at, 10)
    ON CONFLICT (band_id, venue_id) 
    DO UPDATE SET
      gigs_performed = venue_relationships.gigs_performed + 1,
      last_performance_date = NEW.completed_at,
      loyalty_points = venue_relationships.loyalty_points + 10,
      relationship_tier = CASE
        WHEN venue_relationships.loyalty_points + 10 >= 100 THEN 'legendary'
        WHEN venue_relationships.loyalty_points + 10 >= 50 THEN 'favorite'
        WHEN venue_relationships.loyalty_points + 10 >= 20 THEN 'regular'
        ELSE 'newcomer'
      END,
      payout_bonus = CASE
        WHEN venue_relationships.loyalty_points + 10 >= 100 THEN 0.30
        WHEN venue_relationships.loyalty_points + 10 >= 50 THEN 0.20
        WHEN venue_relationships.loyalty_points + 10 >= 20 THEN 0.10
        ELSE 0
      END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_daily_category_stats()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE cat TEXT;
BEGIN
  cat := CASE 
    WHEN NEW.activity_type IN ('book_reading', 'university_attendance', 'mentor_session') THEN 'practice'
    WHEN NEW.activity_type IN ('gig_performance', 'busking', 'recording') THEN 'performance'
    WHEN NEW.activity_type IN ('songwriting', 'rehearsal') THEN 'practice'
    WHEN NEW.activity_type IN ('work_shift') THEN 'quest'
    WHEN NEW.activity_type IN ('twaat') THEN 'social'
    ELSE 'other'
  END;
  INSERT INTO player_daily_cats (profile_id, activity_date, category, xp_earned, activity_count)
  VALUES (NEW.profile_id, CURRENT_DATE, cat, NEW.xp_amount, 1)
  ON CONFLICT (profile_id, activity_date, category) 
  DO UPDATE SET xp_earned = player_daily_cats.xp_earned + EXCLUDED.xp_earned, activity_count = player_daily_cats.activity_count + 1, updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_poll_vote_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE twaater_poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE twaater_poll_options SET vote_count = GREATEST(0, vote_count - 1) WHERE id = OLD.option_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  UPDATE twaater_conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_dikcok_video_views(p_video_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  UPDATE dikcok_videos SET views = views + 1 WHERE id = p_video_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  UPDATE gigs SET status = 'in_progress', started_at = NOW()
  WHERE status = 'scheduled' AND scheduled_date <= NOW() AND started_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_gig_outcome_on_start()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
  v_venue_capacity INT;
  v_venue_name TEXT;
  v_actual_attendance INT;
  v_ticket_revenue INT;
BEGIN
  IF NEW.status = 'in_progress' AND (OLD IS NULL OR OLD.status != 'in_progress') THEN
    SELECT capacity, name INTO v_venue_capacity, v_venue_name FROM venues WHERE id = NEW.venue_id;
    v_actual_attendance := FLOOR(v_venue_capacity * (0.6 + RANDOM() * 0.3));
    v_ticket_revenue := v_actual_attendance * COALESCE(NEW.ticket_price, 20);
    INSERT INTO gig_outcomes (gig_id, actual_attendance, attendance_percentage, ticket_revenue, merch_revenue, total_revenue, venue_cost, crew_cost, equipment_cost, total_costs, net_profit, overall_rating, performance_grade, venue_name, venue_capacity)
    VALUES (NEW.id, v_actual_attendance, (v_actual_attendance::FLOAT / v_venue_capacity::FLOAT) * 100, v_ticket_revenue, 0, v_ticket_revenue, 0, 0, 0, 0, v_ticket_revenue, 0, 'pending', v_venue_name, v_venue_capacity);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_audience_memory()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
  v_city_id UUID;
  v_band_id UUID;
  v_performance_score NUMERIC;
BEGIN
  SELECT g.band_id, v.city_id INTO v_band_id, v_city_id FROM gigs g JOIN venues v ON v.id = g.venue_id WHERE g.id = NEW.gig_id;
  v_performance_score := COALESCE(NEW.overall_rating, 0) * 4;
  INSERT INTO audience_memory (city_id, band_id, gigs_attended, avg_experience_score, last_gig_date)
  VALUES (v_city_id, v_band_id, 1, v_performance_score, NOW())
  ON CONFLICT (city_id, band_id)
  DO UPDATE SET
    gigs_attended = audience_memory.gigs_attended + 1,
    avg_experience_score = (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1),
    last_gig_date = NOW(),
    loyalty_level = CASE
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 80 THEN 'superfan'
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 60 THEN 'fan'
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 40 THEN 'casual'
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 20 THEN 'skeptical'
      ELSE 'hostile'
    END,
    will_attend_again = CASE
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 30 THEN true
      ELSE false
    END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_setlist_for_slot(p_setlist_id uuid, p_slot_type text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
  total_duration INTEGER;
  max_duration INTEGER;
  slot_name TEXT;
  result JSONB;
BEGIN
  total_duration := get_setlist_total_duration(p_setlist_id);
  CASE p_slot_type
    WHEN 'kids' THEN max_duration := 25 * 60; slot_name := 'Kids Slot (30 min max)';
    WHEN 'opening' THEN max_duration := 25 * 60; slot_name := 'Opening Slot (30 min max)';
    WHEN 'support' THEN max_duration := 40 * 60; slot_name := 'Support Slot (45 min max)';
    ELSE max_duration := 70 * 60; slot_name := 'Headline Slot (75 min max)';
  END CASE;
  IF total_duration > max_duration THEN
    result := jsonb_build_object('valid', false, 'message', format('Setlist is %s min but %s allows max %s min', (total_duration / 60)::TEXT, slot_name, (max_duration / 60)::TEXT), 'total_minutes', total_duration / 60, 'max_minutes', max_duration / 60);
  ELSIF total_duration < (max_duration * 0.6) THEN
    result := jsonb_build_object('valid', true, 'message', format('Setlist is only %s min. Consider adding songs to fill the %s', (total_duration / 60)::TEXT, slot_name), 'total_minutes', total_duration / 60, 'max_minutes', max_duration / 60);
  ELSE
    result := jsonb_build_object('valid', true, 'message', NULL, 'total_minutes', total_duration / 60, 'max_minutes', max_duration / 60);
  END IF;
  RETURN result;
END;
$function$;