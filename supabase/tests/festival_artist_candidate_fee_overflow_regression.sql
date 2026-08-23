DO $$
DECLARE
  definition text;
BEGIN
  IF to_regprocedure(
    'public.search_festival_edition_artist_candidates(uuid,uuid,text,integer,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Festival edition artist candidate search RPC is missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.search_festival_edition_artist_candidates(uuid,uuid,text,integer,integer)'::regprocedure
  ) INTO definition;

  IF position('profile.fame, 0)::bigint * 100' IN definition) = 0
     AND position('profile.fame,0)::bigint*100' IN definition) = 0 THEN
    RAISE EXCEPTION 'Festival solo artist minimum fee still uses unsafe integer multiplication';
  END IF;
  IF position('profile.fame, 0)::bigint * 250' IN definition) = 0
     AND position('profile.fame,0)::bigint*250' IN definition) = 0 THEN
    RAISE EXCEPTION 'Festival solo artist maximum fee still uses unsafe integer multiplication';
  END IF;
  IF position('band.popularity, 0)::bigint * 200' IN definition) = 0
     AND position('band.popularity,0)::bigint*200' IN definition) = 0 THEN
    RAISE EXCEPTION 'Festival band minimum fee still uses unsafe integer multiplication';
  END IF;
  IF position('band.popularity, 0)::bigint * 500' IN definition) = 0
     AND position('band.popularity,0)::bigint*500' IN definition) = 0 THEN
    RAISE EXCEPTION 'Festival band maximum fee still uses unsafe integer multiplication';
  END IF;
END;
$$;
