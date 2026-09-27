-- Run against a disposable or explicitly authorised test database.
-- Verifies that the owner sales breakdown does not expose private purchase data
-- to an authenticated role without an owner/admin identity.
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
  IF public.festival_launch_can_manage('3f7b70f6-7b1e-43e9-b890-a2d65164285a'::uuid) THEN
    RAISE EXCEPTION 'Unexpected owner permission without identity';
  END IF;
  BEGIN
    PERFORM public.get_festival_player_ticket_sales_breakdown('3f7b70f6-7b1e-43e9-b890-a2d65164285a'::uuid);
    RAISE EXCEPTION 'Unexpected sales breakdown access without identity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'festival_launch_not_ready' THEN
      RAISE;
    END IF;
  END;
END
$test$;
ROLLBACK;
