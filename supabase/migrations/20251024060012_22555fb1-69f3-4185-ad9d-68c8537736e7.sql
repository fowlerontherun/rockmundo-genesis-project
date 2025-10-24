-- Add hype field to songs
ALTER TABLE songs
ADD COLUMN hype integer DEFAULT 0,
ADD COLUMN total_radio_plays integer DEFAULT 0,
ADD COLUMN last_radio_play timestamp with time zone;

-- Create radio stations table
CREATE TABLE radio_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  station_type character varying NOT NULL CHECK (station_type IN ('national', 'local')),
  country character varying,
  city_id uuid REFERENCES cities(id),
  quality_level integer NOT NULL DEFAULT 3 CHECK (quality_level BETWEEN 1 AND 5),
  listener_base integer NOT NULL DEFAULT 10000,
  accepted_genres text[] DEFAULT '{}',
  description text,
  frequency character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT station_location_check CHECK (
    (station_type = 'national' AND country IS NOT NULL AND city_id IS NULL) OR
    (station_type = 'local' AND city_id IS NOT NULL)
  )
);

-- Create radio shows table
CREATE TABLE radio_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES radio_stations(id) ON DELETE CASCADE,
  show_name character varying NOT NULL,
  host_name character varying NOT NULL,
  time_slot character varying NOT NULL CHECK (time_slot IN ('morning_drive', 'midday', 'afternoon_drive', 'evening', 'late_night', 'overnight', 'weekend')),
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  listener_multiplier numeric DEFAULT 1.0,
  show_genres text[] DEFAULT '{}',
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create radio submissions table
CREATE TABLE radio_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  band_id uuid REFERENCES bands(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES radio_stations(id) ON DELETE CASCADE,
  submitted_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_at timestamp with time zone,
  rejection_reason text,
  week_submitted date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT one_submission_per_week UNIQUE (station_id, song_id, week_submitted)
);

-- Create radio playlists table
CREATE TABLE radio_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES radio_shows(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  times_played integer DEFAULT 0,
  added_at timestamp with time zone DEFAULT now(),
  removed_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (show_id, song_id, week_start_date)
);

-- Create radio plays table
CREATE TABLE radio_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES radio_playlists(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  show_id uuid NOT NULL REFERENCES radio_shows(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES radio_stations(id) ON DELETE CASCADE,
  played_at timestamp with time zone DEFAULT now(),
  listeners integer NOT NULL,
  hype_gained integer DEFAULT 0,
  sales_boost integer DEFAULT 0,
  streams_boost integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_radio_stations_country ON radio_stations(country);
CREATE INDEX idx_radio_stations_city ON radio_stations(city_id);
CREATE INDEX idx_radio_shows_station ON radio_shows(station_id);
CREATE INDEX idx_radio_submissions_station ON radio_submissions(station_id, status);
CREATE INDEX idx_radio_submissions_song ON radio_submissions(song_id);
CREATE INDEX idx_radio_playlists_show_week ON radio_playlists(show_id, week_start_date, is_active);
CREATE INDEX idx_radio_plays_song ON radio_plays(song_id);
CREATE INDEX idx_songs_hype ON songs(hype DESC);

-- Enable RLS
ALTER TABLE radio_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_plays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for radio_stations
CREATE POLICY "Radio stations viewable by everyone" ON radio_stations FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage radio stations" ON radio_stations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for radio_shows
CREATE POLICY "Radio shows viewable by everyone" ON radio_shows FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage radio shows" ON radio_shows FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for radio_submissions
CREATE POLICY "Users can view their own submissions" ON radio_submissions FOR SELECT USING (user_id = auth.uid() OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can create submissions" ON radio_submissions FOR INSERT WITH CHECK (user_id = auth.uid() OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage submissions" ON radio_submissions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for radio_playlists
CREATE POLICY "Playlists viewable by everyone" ON radio_playlists FOR SELECT USING (true);
CREATE POLICY "Admins can manage playlists" ON radio_playlists FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for radio_plays
CREATE POLICY "Radio plays viewable by everyone" ON radio_plays FOR SELECT USING (true);
CREATE POLICY "System can insert plays" ON radio_plays FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_radio_stations_updated_at BEFORE UPDATE ON radio_stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_radio_shows_updated_at BEFORE UPDATE ON radio_shows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();