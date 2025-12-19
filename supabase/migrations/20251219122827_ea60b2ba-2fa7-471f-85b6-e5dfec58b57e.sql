-- Create newspaper_submissions table
CREATE TABLE newspaper_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  newspaper_id uuid NOT NULL REFERENCES newspapers(id) ON DELETE CASCADE,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'completed')),
  interview_type varchar DEFAULT 'short_feature' CHECK (interview_type IN ('short_feature', 'full_interview', 'cover_story')),
  proposed_date timestamp with time zone,
  fame_boost integer,
  fan_boost integer,
  compensation integer,
  rejection_reason text,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(band_id, newspaper_id, status) -- Prevent duplicate pending submissions
);

-- Create magazine_submissions table
CREATE TABLE magazine_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  magazine_id uuid NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'completed')),
  feature_type varchar DEFAULT 'profile' CHECK (feature_type IN ('profile', 'interview', 'cover_feature')),
  proposed_date timestamp with time zone,
  fame_boost integer,
  fan_boost integer,
  compensation integer,
  rejection_reason text,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(band_id, magazine_id, status)
);

-- Create podcast_submissions table
CREATE TABLE podcast_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  podcast_id uuid NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'completed')),
  episode_topic varchar,
  proposed_date timestamp with time zone,
  fame_boost integer,
  fan_boost integer,
  compensation integer,
  rejection_reason text,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(band_id, podcast_id, status)
);

-- Add country column to podcasts if not exists
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS country text;

-- Enable RLS on all new tables
ALTER TABLE newspaper_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazine_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for newspaper_submissions
CREATE POLICY "Users can view their own newspaper submissions"
ON newspaper_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create newspaper submissions for their bands"
ON newspaper_submissions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM band_members WHERE band_id = newspaper_submissions.band_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update their own newspaper submissions"
ON newspaper_submissions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for magazine_submissions
CREATE POLICY "Users can view their own magazine submissions"
ON magazine_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create magazine submissions for their bands"
ON magazine_submissions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM band_members WHERE band_id = magazine_submissions.band_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update their own magazine submissions"
ON magazine_submissions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for podcast_submissions
CREATE POLICY "Users can view their own podcast submissions"
ON podcast_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create podcast submissions for their bands"
ON podcast_submissions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM band_members WHERE band_id = podcast_submissions.band_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update their own podcast submissions"
ON podcast_submissions FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_newspaper_submissions_band ON newspaper_submissions(band_id);
CREATE INDEX idx_newspaper_submissions_status ON newspaper_submissions(status);
CREATE INDEX idx_magazine_submissions_band ON magazine_submissions(band_id);
CREATE INDEX idx_magazine_submissions_status ON magazine_submissions(status);
CREATE INDEX idx_podcast_submissions_band ON podcast_submissions(band_id);
CREATE INDEX idx_podcast_submissions_status ON podcast_submissions(status);