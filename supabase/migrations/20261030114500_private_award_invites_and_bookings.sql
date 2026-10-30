-- Awards invitations are private dealings. Only their recipients and
-- administrators can view the terms; invitees respond via the validated RPC.
-- Performance bookings are created by the admin or by the SECURITY DEFINER
-- award_show_respond_invite when a real performer invite is accepted.
-- No existing invitations/bookings are changed by this migration.

-- Both historical migrations created public SELECT policies; remove BOTH.
DROP POLICY IF EXISTS "Award invites are viewable by everyone" ON public.award_show_invites;
DROP POLICY IF EXISTS "Invites viewable by everyone" ON public.award_show_invites;
DROP POLICY IF EXISTS "Award invite recipients can view" ON public.award_show_invites;

CREATE POLICY "Award invite recipients can view"
  ON public.award_show_invites FOR SELECT TO authenticated
  USING (
    COALESCE(public.has_role(auth.uid(), 'admin'), false)
    OR invitee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = invitee_user_id AND p.user_id = auth.uid()
    )
    OR (
      invitee_band_id IS NOT NULL
      AND public.caller_can_act_for_band(invitee_band_id)
    )
  );

-- Both historical invitee UPDATE policies permit editing arbitrary columns,
-- not just response_status. Replace them with the existing response RPC.
DROP POLICY IF EXISTS "Invitees can respond to invites" ON public.award_show_invites;
DROP POLICY IF EXISTS "Invitees respond to invites" ON public.award_show_invites;
REVOKE SELECT ON public.award_show_invites FROM anon;

-- Direct browser booking used to accept any band_id because only the account
-- ID was checked. No player INSERT policy is required: accepted performer
-- invites are booked atomically within award_show_respond_invite.
DROP POLICY IF EXISTS "Users can book performances" ON public.award_performance_bookings;
DROP POLICY IF EXISTS "Award admins can book performances" ON public.award_performance_bookings;
CREATE POLICY "Award admins can book performances"
  ON public.award_performance_bookings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND COALESCE(public.has_role(auth.uid(), 'admin'), false)
  );
