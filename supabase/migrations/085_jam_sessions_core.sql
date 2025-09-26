-- Migration 085: Core tables for jam sessions

CREATE TYPE public.jam_session_status AS ENUM ('scheduled', 'active', 'completed', 'canceled', 'no_show', 'expired');
CREATE TYPE public.jam_session_attendee_role AS ENUM ('leader', 'member', 'guest');
CREATE TYPE public.jam_session_attendee_rsvp AS ENUM ('going', 'maybe', 'declined', 'no_response');

CREATE TABLE public.jam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  status public.jam_session_status NOT NULL DEFAULT 'scheduled',
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (duration_minutes IN (60, 120, 240)),
  CHECK (scheduled_end_at > scheduled_start_at)
);

CREATE INDEX IF NOT EXISTS idx_jam_sessions_band_id ON public.jam_sessions(band_id);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_status ON public.jam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_start_at ON public.jam_sessions(scheduled_start_at);

CREATE TABLE public.jam_session_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id uuid NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.jam_session_attendee_role NOT NULL DEFAULT 'member',
  rsvp_status public.jam_session_attendee_rsvp NOT NULL DEFAULT 'no_response',
  check_in_at timestamptz,
  check_out_at timestamptz,
  CHECK (check_out_at IS NULL OR check_out_at >= check_in_at),
  UNIQUE (jam_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_jam_session_attendees_session ON public.jam_session_attendees(jam_session_id);
CREATE INDEX IF NOT EXISTS idx_jam_session_attendees_user ON public.jam_session_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_jam_session_attendees_rsvp ON public.jam_session_attendees(rsvp_status);

CREATE TABLE public.jam_session_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id uuid NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  focus_weight integer NOT NULL DEFAULT 1,
  CHECK (focus_weight > 0),
  UNIQUE (jam_session_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_jam_session_songs_session ON public.jam_session_songs(jam_session_id);
CREATE INDEX IF NOT EXISTS idx_jam_session_songs_song ON public.jam_session_songs(song_id);

CREATE TABLE public.jam_session_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id uuid NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  chemistry_delta integer NOT NULL DEFAULT 0,
  cohesion_delta integer NOT NULL DEFAULT 0,
  per_song_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  calc_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jam_session_id)
);

CREATE INDEX IF NOT EXISTS idx_jam_session_results_session ON public.jam_session_results(jam_session_id);
