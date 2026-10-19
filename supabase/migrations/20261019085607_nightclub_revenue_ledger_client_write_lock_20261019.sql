-- Future DJ fee budgets and club finance reports must not trust browser-minted ledger revenue.
-- The log currently has no client/SQL writer in use and is preserved for trusted settlement work.
DROP POLICY IF EXISTS "Players can insert revenue for own clubs" ON public.nightclub_revenue_log;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES
 ON TABLE public.nightclub_revenue_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.nightclub_revenue_log TO authenticated;
COMMENT ON TABLE public.nightclub_revenue_log IS
 'Server-authored club revenue history only. Never accept player-written income; future DJ fee and attendance settlement must use idempotent server ledger actions.';