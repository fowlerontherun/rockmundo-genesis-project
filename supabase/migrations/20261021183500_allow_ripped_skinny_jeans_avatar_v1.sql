-- Permit the existing standard black ripped skinny jeans selection in saved Avatar V1 appearances.
-- This item already exists in the frontend STARTER_ITEMS catalogue and V1 renderer.
-- Keep all other schema checks and ownership constraints unchanged.
DO $body$
DECLARE
  definition text;
  old_item text := quote_literal('starter.bottom.dark-slim-jeans');
  new_item text := quote_literal('starter.bottom.black-ripped-skinny-jeans');
BEGIN
  definition := pg_get_functiondef('public.is_valid_player_stage_appearance(jsonb)'::regprocedure);
  IF position(new_item in definition) > 0 THEN RETURN; END IF;
  IF position(old_item in definition) = 0 THEN
    RAISE EXCEPTION 'Expected existing V1 validator item was not found; refusing unsafe rewrite';
  END IF;
  definition := replace(definition, old_item, old_item || ',' || new_item);
  EXECUTE definition;
END
$body$;
