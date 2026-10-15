-- Future-only durable account invites, gig offers and release completion.
-- Scopes all recipients by authoritative band membership or the invite target.
BEGIN;
CREATE OR REPLACE FUNCTION public.rockmundo_offer_release_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
  v_band uuid; v_user uuid; v_key text; v_category text; v_type text;
  v_title text; v_message text; v_path text; v_rec record;
BEGIN
  IF TG_TABLE_NAME='band_invitations' THEN
    IF TG_OP<>'INSERT' OR NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
    v_user:=NEW.invited_user_id;
    v_key:='band_invite:'||NEW.id::text;
    v_category:='social'; v_type:='band_invite'; v_title:='Band Invitation!';
    v_path:='/band/members';
    SELECT 'You have been invited to join '||coalesce(b.name,'a band')||'!'
      INTO v_message FROM public.bands b WHERE b.id=NEW.band_id;
    v_message:=coalesce(v_message,'You have received a band invitation.');
    -- Invitations belong to the account, not whichever character is active.
    IF v_user IS NOT NULL AND EXISTS(
      SELECT 1 FROM auth.users u WHERE u.id=v_user
    ) THEN
      INSERT INTO public.notifications
        (user_id,profile_id,category,type,title,message,action_path,metadata)
      VALUES (v_user,NULL,v_category,v_type,v_title,v_message,v_path,
        jsonb_build_object('event_key',v_key,'source','game_event',
                           'band_id',NEW.band_id,'band_invitation_id',NEW.id))
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='releases' THEN
    IF TG_OP<>'UPDATE' OR OLD.release_status IS DISTINCT FROM 'manufacturing'
       OR NEW.release_status IS DISTINCT FROM 'released'
    THEN RETURN NEW; END IF;
    v_user:=NEW.user_id; v_band:=NEW.band_id;
    v_key:='release_manufactured:'||NEW.id::text;
    v_category:='release'; v_type:='success';
    v_title:='Manufacturing Complete!';
    v_message:='Your release "'||coalesce(NEW.title,'Untitled')||'" has finished manufacturing and is now available!';
    v_path:='/release-manager';
  ELSIF TG_TABLE_NAME='gig_offers' THEN
    IF TG_OP<>'INSERT' OR NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
    v_band:=NEW.band_id;
    v_key:='gig_offer:'||NEW.id::text;
    v_category:='gig_result'; v_type:='offer'; v_title:='New Gig Offer!';
    v_message:='Your band has received a new gig offer.';
    v_path:='/gig-booking';
  ELSE RETURN NEW;
  END IF;

  IF v_band IS NOT NULL THEN
    FOR v_rec IN
      SELECT DISTINCT p.user_id,p.id AS profile_id
      FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id
      WHERE bm.band_id=v_band AND bm.member_status='active'
        AND p.deleted_at IS NULL
    LOOP
      INSERT INTO public.notifications
        (user_id,profile_id,category,type,title,message,action_path,metadata)
      VALUES(v_rec.user_id,v_rec.profile_id,v_category,v_type,
        left(v_title,240),left(v_message,2000),v_path,
        jsonb_build_object('event_key',v_key,'source','game_event'))
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSIF v_user IS NOT NULL THEN
    -- Releases without a band have account-level ownership.
    INSERT INTO public.notifications
      (user_id,profile_id,category,type,title,message,action_path,metadata)
    VALUES(v_user,NULL,v_category,v_type,left(v_title,240),
      left(v_message,2000),v_path,
      jsonb_build_object('event_key',v_key,'source','game_event'))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$f$;
REVOKE ALL ON FUNCTION public.rockmundo_offer_release_notification()
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS rockmundo_band_invite_durable_notification ON public.band_invitations;
CREATE TRIGGER rockmundo_band_invite_durable_notification
  AFTER INSERT ON public.band_invitations FOR EACH ROW
  WHEN (NEW.status='pending')
  EXECUTE FUNCTION public.rockmundo_offer_release_notification();

DROP TRIGGER IF EXISTS rockmundo_release_durable_notification ON public.releases;
CREATE TRIGGER rockmundo_release_durable_notification
  AFTER UPDATE OF release_status ON public.releases FOR EACH ROW
  WHEN (OLD.release_status='manufacturing' AND NEW.release_status='released')
  EXECUTE FUNCTION public.rockmundo_offer_release_notification();

DROP TRIGGER IF EXISTS rockmundo_gig_offer_durable_notification ON public.gig_offers;
CREATE TRIGGER rockmundo_gig_offer_durable_notification
  AFTER INSERT ON public.gig_offers FOR EACH ROW
  WHEN (NEW.status='pending')
  EXECUTE FUNCTION public.rockmundo_offer_release_notification();
COMMIT;