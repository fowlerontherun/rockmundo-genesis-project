-- During the frontend transition, older clients still issue direct
-- botb_entries DELETE requests. Keep that grant temporarily, but prevent
-- inactive ex-members and after-start withdrawals at the RLS boundary.
--
-- RPC-only withdrawal (with consistent event row lock) is now available.
-- After the new client is deployed, remove direct DELETE entirely.
DROP POLICY IF EXISTS "Band members can withdraw their entry"
  ON public.botb_entries;
CREATE POLICY "Band members can withdraw their entry"
  ON public.botb_entries FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id=botb_entries.band_id
        AND bm.user_id=(SELECT auth.uid())
        AND COALESCE(bm.member_status,'active')='active'
    )
    AND EXISTS (
      SELECT 1 FROM public.botb_events e
      WHERE e.id=botb_entries.event_id
        AND e.status='upcoming'
        AND e.scheduled_date>clock_timestamp()
    )
  );
