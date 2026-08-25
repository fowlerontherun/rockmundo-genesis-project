-- Support slot lifecycle mutations must go through the SECURITY DEFINER RPCs.
-- Direct INSERT/UPDATE would otherwise bypass acceptance-time conflict checks.

DROP POLICY IF EXISTS "Headliners can create support slots" ON public.gig_support_slots;
DROP POLICY IF EXISTS "Involved bands can update support slots" ON public.gig_support_slots;

-- SELECT remains available to the two involved bands via the Phase 1 policy.
-- service_role continues to bypass RLS for administration/repair.

COMMENT ON TABLE public.gig_support_slots IS
  'Support invitation lifecycle. Authenticated clients may read involved slots but all lifecycle mutations must use create_gig_support_offer/respond_to_gig_support_offer/cancel_gig_support_offer.';
