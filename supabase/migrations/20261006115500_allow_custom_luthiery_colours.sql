-- Allow any six-digit RGB body colour from the Luthiery workbench.
-- Keep validation server-authoritative while removing the old fixed-palette restriction.
DO $fix$
DECLARE
  v_definition text;
  v_old_condition text := 'IF NOT (v_colour = ANY(ARRAY[''#141821'',''#e7e0cf'',''#8f2435'',''#235f9f'',''#245b43'',''#b8892f'',''#6f42a8'',''#c8377d'',''#9b6a3d''])) THEN';
  v_new_condition text := 'IF v_colour !~ ''^#[0-9a-f]{6}$'' THEN';
BEGIN
  SELECT pg_get_functiondef('public.create_custom_luthiery_instrument(uuid,jsonb,text)'::regprocedure)
  INTO v_definition;

  IF position(v_new_condition IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_old_condition IN v_definition) = 0 THEN
    RAISE EXCEPTION 'create_custom_luthiery_instrument colour validation shape has changed';
  END IF;

  v_definition := replace(v_definition, v_old_condition, v_new_condition);
  EXECUTE v_definition;
END
$fix$;
