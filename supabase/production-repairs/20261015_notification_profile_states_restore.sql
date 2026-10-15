-- Audit copy of production migration applied 2026-10-15 under name rockmundo_20261015_notification_profile_states_restore. Future-dated source 20300106181000... should not be blindly replayed.
-- #3980/#3981: soft-hide notifications per character; never delete shared
-- account-level notification rows when a single character archives/clears them.
BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_profile_states (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id,profile_id)
);
CREATE INDEX IF NOT EXISTS notification_profile_states_user_profile_idx
  ON public.notification_profile_states(user_id,profile_id);

ALTER TABLE public.notification_profile_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_profile_states_owner_read ON public.notification_profile_states;
CREATE POLICY notification_profile_states_owner_read ON public.notification_profile_states
  FOR SELECT TO authenticated
  USING (user_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()
  ));

REVOKE ALL ON public.notification_profile_states FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.notification_profile_states TO authenticated;

CREATE OR REPLACE FUNCTION public.set_notification_profile_states(
  p_profile_id uuid, p_notification_ids uuid[], p_action text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id
      AND p.user_id=auth.uid() AND p.deleted_at IS NULL AND p.died_at IS NULL
  ) THEN RAISE EXCEPTION 'Active character is not available.' USING ERRCODE='42501'; END IF;
  IF p_action NOT IN ('read','archive','delete') THEN
    RAISE EXCEPTION 'Unknown notification state action.' USING ERRCODE='22023'; END IF;
  IF p_notification_ids IS NULL OR array_length(p_notification_ids,1) IS NULL THEN RETURN 0; END IF;
  IF cardinality(p_notification_ids)>1000 THEN
    RAISE EXCEPTION 'Too many notifications in one operation.' USING ERRCODE='22023'; END IF;

  INSERT INTO public.notification_profile_states (
    notification_id,user_id,profile_id,read_at,archived_at,deleted_at
  )
  SELECT DISTINCT n.id,n.user_id,p_profile_id,
    CASE WHEN p_action='read' THEN now() ELSE NULL END,
    CASE WHEN p_action='archive' THEN now() ELSE NULL END,
    CASE WHEN p_action='delete' THEN now() ELSE NULL END
  FROM public.notifications n
  JOIN (SELECT DISTINCT unnest(p_notification_ids) AS id) wanted ON wanted.id=n.id
  WHERE n.user_id=auth.uid()
    AND (n.profile_id=p_profile_id OR (
      n.profile_id IS NULL AND
      (n.metadata->>'profile_id' IS NULL OR n.metadata->>'profile_id'=p_profile_id::text)
    ))
  ON CONFLICT (notification_id,profile_id) DO UPDATE SET
    read_at=COALESCE(notification_profile_states.read_at, EXCLUDED.read_at),
    archived_at=COALESCE(notification_profile_states.archived_at, EXCLUDED.archived_at),
    deleted_at=COALESCE(notification_profile_states.deleted_at, EXCLUDED.deleted_at),
    updated_at=now();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.set_notification_profile_states(uuid,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_notification_profile_states(uuid,uuid[],text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
