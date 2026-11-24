-- Booking acceptance and completion must only run through authorised server functions.
REVOKE INSERT,UPDATE,DELETE ON public.gig_support_slots FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS "Headliners can create support slots" ON public.gig_support_slots;
DROP POLICY IF EXISTS "Involved bands can update support slots" ON public.gig_support_slots;
GRANT SELECT ON public.gig_support_slots TO authenticated;
NOTIFY pgrst,'reload schema';
