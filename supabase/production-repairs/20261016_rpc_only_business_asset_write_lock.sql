-- Production security repair: close direct asset creation/edit paths that bypass
-- the server-priced, debit-backed business purchase RPCs. Current user-facing
-- hooks read these tables and purchase through RPCs; DELETE is unchanged.
-- Existing staff/asset data is untouched. Service role and SECURITY DEFINER
-- owner (postgres) retain required privileges.
-- Label staff is only partly locked until the older LabelStaffTab is deployed:
-- its direct client INSERT must be removed before revoking INSERT on label_staff.
REVOKE INSERT, UPDATE ON TABLE
  public.logistics_drivers,
  public.merch_factory_workers,
  public.logistics_fleet_vehicles,
  public.logistics_upgrades,
  public.security_firm_upgrades,
  public.venue_staff,
  public.recording_studio_staff,
  public.rehearsal_room_staff,
  public.security_guards,
  public.recording_studio_equipment,
  public.rehearsal_room_equipment,
  public.venue_upgrades,
  public.recording_studio_upgrades,
  public.rehearsal_room_upgrades
FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON TABLE public.label_staff FROM PUBLIC, anon, authenticated;
