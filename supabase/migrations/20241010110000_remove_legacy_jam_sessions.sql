-- Remove jam session schema introduced in migration 085 so the lightweight tables from
-- 20241010120000_enable_busking_core.sql can define the structure.

-- Drop legacy tables if they still exist.
drop table if exists public.jam_session_results;
drop table if exists public.jam_session_songs;
drop table if exists public.jam_session_attendees;
drop table if exists public.jam_sessions;

-- Drop legacy enum types that supported the removed tables.
drop type if exists public.jam_session_attendee_rsvp;
drop type if exists public.jam_session_attendee_role;
drop type if exists public.jam_session_status;
