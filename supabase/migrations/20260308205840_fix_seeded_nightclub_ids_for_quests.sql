-- Fresh database replays create seeded nightclub IDs with gen_random_uuid(),
-- while the historical quest seed migrations below reference canonical UUIDs
-- that already exist in production. Pin only the clubs referenced by those
-- quest migrations, resolving each club by its unique seeded NPC id.
--
-- This is intentionally placed immediately before the first nightclub quest
-- seed so existing production databases (where this historical migration is
-- already past) are unaffected, while clean replays preserve the same IDs.

DO $$
DECLARE
  mapping record;
  current_club_id uuid;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('womb_dj_ken', 'bad67b52-9f49-4b98-ae4c-a76007370d19'::uuid),
      ('cake_dj_park', '410ad098-c58c-4d93-8efc-82ddb75d4d14'::uuid),
      ('beam_dj_sunju', 'fbf18fea-bd74-49c1-8a1f-214fbea21395'::uuid),
      ('laundry_dj_touch', '56d00bb5-4087-46b5-a452-9181d747bd61'::uuid)
    ) AS mappings(npc_id, canonical_id)
  LOOP
    SELECT cnc.id
      INTO current_club_id
      FROM public.city_night_clubs AS cnc
     WHERE EXISTS (
       SELECT 1
         FROM jsonb_array_elements(COALESCE(cnc.npc_profiles, '[]'::jsonb)) AS npc
        WHERE npc ->> 'id' = mapping.npc_id
     )
     LIMIT 1;

    IF current_club_id IS NULL THEN
      RAISE EXCEPTION 'Seeded nightclub for NPC % was not found during clean replay', mapping.npc_id;
    END IF;

    IF current_club_id <> mapping.canonical_id THEN
      IF EXISTS (
        SELECT 1
          FROM public.city_night_clubs
         WHERE id = mapping.canonical_id
           AND id <> current_club_id
      ) THEN
        RAISE EXCEPTION 'Canonical nightclub UUID % is already assigned to another club', mapping.canonical_id;
      END IF;

      UPDATE public.city_night_clubs
         SET id = mapping.canonical_id
       WHERE id = current_club_id;
    END IF;
  END LOOP;
END
$$;
