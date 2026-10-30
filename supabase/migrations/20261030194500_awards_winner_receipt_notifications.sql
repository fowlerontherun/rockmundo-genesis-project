-- Send a durable, per-character award-win notice when a REAL win is inserted.
-- No backfill: historic or pending shows are not modified by this migration.
-- Inserts are in the same transaction as award_wins and prize settlement;
-- a failed settlement rolls back notifications too.

CREATE UNIQUE INDEX IF NOT EXISTS award_winner_notification_one_per_profile
 ON public.notifications (
   profile_id, (metadata->>'award_win_id')
 )
 WHERE category='awards'
   AND profile_id IS NOT NULL
   AND metadata->>'award_win_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_award_winner_receipt()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_show_name text;
  v_message text;
BEGIN
  -- Non-band award recipients require a separate account/person award path.
  IF NEW.band_id IS NULL THEN RETURN NEW; END IF;

  SELECT show_name INTO v_show_name FROM public.award_shows
   WHERE id=NEW.award_show_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award show missing for winner notification';
  END IF;

  v_message := NEW.winner_name || ' won ' || NEW.category_name
    || ' at ' || v_show_name
    || '. Fame awarded: +' || NEW.fame_boost::text
    || CASE WHEN NEW.prize_money > 0
       THEN '. Band prize: $' || NEW.prize_money::text
       ELSE '' END || '.';

  -- One notification per living band character, including the leader.
  -- The normal inbox is profile-scoped; a user_id-only notice would not
  -- show consistently in the character's unread notification counter.
  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  )
  SELECT p.user_id, p.id, 'awards', 'success',
    'Award won: ' || NEW.category_name, v_message, '/awards',
    jsonb_build_object(
      'award_win_id',NEW.id,'award_show_id',NEW.award_show_id,
      'band_id',NEW.band_id,'category_name',NEW.category_name
    )
  FROM public.profiles p
  WHERE p.user_id IS NOT NULL
    AND p.deleted_at IS NULL AND p.died_at IS NULL
    AND (
      p.id=(SELECT b.leader_id FROM public.bands b WHERE b.id=NEW.band_id)
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id=NEW.band_id AND bm.profile_id=p.id
          AND bm.member_status='active'
      )
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_award_winner_receipt()
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS award_winner_notification_receipt_trg
  ON public.award_wins;
CREATE TRIGGER award_winner_notification_receipt_trg
  AFTER INSERT ON public.award_wins
  FOR EACH ROW EXECUTE FUNCTION public.notify_award_winner_receipt();
