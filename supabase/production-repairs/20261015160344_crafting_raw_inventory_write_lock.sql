-- Lock client-side crafting writes until server-authoritative crafting RPCs
-- have been reconciled and exercised end-to-end. Existing SECURITY DEFINER
-- starter-blueprint and luthiery functions continue using owner privileges.
BEGIN;
REVOKE ALL ON TABLE
 public.crafting_blueprints,
 public.crafting_sessions,
 public.player_crafting_materials
FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE
 public.crafting_blueprints,
 public.crafting_sessions,
 public.player_crafting_materials
TO authenticated;

ALTER TABLE public.crafting_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crafting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_crafting_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can insert own blueprints"
 ON public.crafting_blueprints;
DROP POLICY IF EXISTS "Players can insert own sessions"
 ON public.crafting_sessions;
DROP POLICY IF EXISTS "Players can update own sessions"
 ON public.crafting_sessions;
DROP POLICY IF EXISTS "Players can insert own materials"
 ON public.player_crafting_materials;
DROP POLICY IF EXISTS "Players can update own materials"
 ON public.player_crafting_materials;
DROP POLICY IF EXISTS "Players can delete own materials"
 ON public.player_crafting_materials;

COMMIT;