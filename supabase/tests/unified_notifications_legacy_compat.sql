-- Regression: model the September 2025 notifications table, then apply the
-- same April 2026 forward-compat DDL against a temporary copy.
-- No live player notifications are inserted, modified or removed.
BEGIN;
CREATE TEMP TABLE legacy_notifications_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('gig_invite','band_request','fan_milestone','achievement','system')),
  message text NOT NULL,
  "read" boolean NOT NULL DEFAULT false,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO legacy_notifications_test(user_id,type,message,"read","timestamp") VALUES
('00000000-0000-0000-0000-000000000001','gig_invite','Preserved invitation',true,'2026-01-15T10:00:00Z'),
('00000000-0000-0000-0000-000000000002','achievement','Preserved achievement',false,'2026-01-18T12:00:00Z');

-- The compatibility block from the historic migration, rewritten solely to
-- target the above temp fixture; changes to migration logic should be mirrored.
-- The September 2025 migration already created notifications, but with
-- legacy `read` / `timestamp` columns and a five-value `type` CHECK.
-- CREATE TABLE IF NOT EXISTS does not reconcile that older shape. Backfill
-- the unified fields before indexing them or using the mirror trigger.
-- Keep the legacy columns so old consumers and historical migrations continue
-- working until they are migrated explicitly.
ALTER TABLE pg_temp.legacy_notifications_test
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS action_path text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

DO $notification_legacy_compat$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema LIKE 'pg_temp_%' AND table_name='legacy_notifications_test'
      AND column_name='timestamp'
  ) THEN
    UPDATE pg_temp.legacy_notifications_test
      SET created_at = "timestamp"
    WHERE created_at IS NULL;
  END IF;

  UPDATE pg_temp.legacy_notifications_test
    SET created_at = now()
  WHERE created_at IS NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema LIKE 'pg_temp_%' AND table_name='legacy_notifications_test'
      AND column_name='read'
  ) THEN
    -- The old schema tracks only a read Boolean, not when it was read.
    -- Use its original creation date as a conservative approximate read_at.
    UPDATE pg_temp.legacy_notifications_test
      SET read_at = created_at
    WHERE "read" IS TRUE AND read_at IS NULL;
  END IF;

  UPDATE pg_temp.legacy_notifications_test
    SET category = COALESCE(NULLIF(type,''), 'legacy')
  WHERE category IS NULL;

  UPDATE pg_temp.legacy_notifications_test
    SET title = initcap(replace(COALESCE(NULLIF(type,''),'notification'), '_', ' '))
  WHERE title IS NULL;

  -- The unified mirror helper writes values such as info, offer and success.
  -- The 2025 CHECK accepted only five legacy enum-like values; replace only
  -- that known legacy CHECK, without removing any unknown constraints.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='pg_temp.legacy_notifications_test'::regclass
      AND conname='legacy_notifications_test_type_check'
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%gig_invite%'
  ) THEN
    ALTER TABLE pg_temp.legacy_notifications_test DROP CONSTRAINT legacy_notifications_test_type_check;
  END IF;
END $notification_legacy_compat$;

ALTER TABLE pg_temp.legacy_notifications_test
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'info';


INSERT INTO legacy_notifications_test(user_id,type,message,category,title)
VALUES ('00000000-0000-0000-0000-000000000003','info','New event','system','New event');

DO $check$
BEGIN
 IF (SELECT count(*) FROM legacy_notifications_test) <> 3 THEN
   RAISE EXCEPTION 'Forward compatibility dropped legacy notifications';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM legacy_notifications_test WHERE message='Preserved invitation'
     AND category='gig_invite' AND title='Gig Invite'
     AND created_at='2026-01-15T10:00:00Z' AND read_at='2026-01-15T10:00:00Z'
 ) THEN RAISE EXCEPTION 'Legacy read and creation dates not preserved'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM legacy_notifications_test WHERE message='Preserved achievement'
     AND category='achievement' AND created_at='2026-01-18T12:00:00Z'
     AND read_at IS NULL
 ) THEN RAISE EXCEPTION 'Legacy unread notification not preserved'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM legacy_notifications_test
  WHERE message='New event' AND type='info' AND created_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Modern notification type insert blocked'; END IF;
END $check$;
ROLLBACK;

-- Validate that the real merged notifications table has the canonical shape.
DO $verify$
BEGIN
 IF EXISTS (SELECT 1 FROM public.notifications
   WHERE category IS NULL OR title IS NULL OR created_at IS NULL)
 THEN RAISE EXCEPTION 'Canonical notifications contain NULL required fields'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
   AND tablename='notifications' AND indexname='idx_notifications_user_created')
 THEN RAISE EXCEPTION 'Missing canonical notifications created_at index'; END IF;
END $verify$;
