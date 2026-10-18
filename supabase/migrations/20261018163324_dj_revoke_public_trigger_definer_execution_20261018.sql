-- Applied directly to production Supabase as 20261018163324.
-- Eight DJ schedule/booking SECURITY DEFINER trigger functions were granted
-- to anon/authenticated despite never being public RPCs. Remove those grants.
-- Trigger attachments are unaffected, and trusted triggers still run normally.
REVOKE EXECUTE ON FUNCTION public._dj_guard_band_join_conflicts() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public._dj_guard_city_timezone_update() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public._dj_guard_course_timetable_update() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public._dj_guard_university_city_update() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_dj_reverse_activity_source() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_dj_reverse_band_gig_write() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_dj_reverse_university_enrolment() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.project_dj_booking_into_calendar() FROM PUBLIC,anon,authenticated;
