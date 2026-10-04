-- Compatibility repair for the first live Phase 4 deployment.
-- Fresh databases already use the corrected key-count expression in the base migration.
DO $fix$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.create_custom_luthiery_instrument(uuid,jsonb,text)'::regprocedure)
  INTO v_definition;

  IF position('jsonb_object_length(v_parts) <> 5' IN v_definition) > 0 THEN
    v_definition := replace(
      v_definition,
      'jsonb_object_length(v_parts) <> 5',
      '(SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_parts)) <> 5'
    );
    EXECUTE v_definition;
  END IF;
END
$fix$;
