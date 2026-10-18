-- XP progression and attribute tracking foundations

-- Wallet storing spendable XP and aggregated counters
CREATE TABLE IF NOT EXISTS public.player_xp_wallet (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_balance integer NOT NULL DEFAULT 0 CHECK (xp_balance >= 0),
  lifetime_xp integer NOT NULL DEFAULT 0 CHECK (lifetime_xp >= 0),
  xp_spent integer NOT NULL DEFAULT 0 CHECK (xp_spent >= 0),
  attribute_points_earned integer NOT NULL DEFAULT 0 CHECK (attribute_points_earned >= 0),
  skill_points_earned integer NOT NULL DEFAULT 0 CHECK (skill_points_earned >= 0),
  last_recalculated timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_player_xp_wallet_updated_at
  ON public.player_xp_wallet (last_recalculated DESC);

-- Ledger capturing individual XP movements for auditing and analytics
CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  xp_delta integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  attribute_points_delta integer NOT NULL DEFAULT 0,
  skill_points_delta integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT xp_ledger_non_zero_change CHECK (
    xp_delta <> 0 OR attribute_points_delta <> 0 OR skill_points_delta <> 0
  )
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_profile_created_at
  ON public.xp_ledger (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_event_type
  ON public.xp_ledger (event_type);

-- Ensure a consistent structure for player attributes focused on profiles
CREATE TABLE IF NOT EXISTS public.player_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.player_attributes
  ADD COLUMN IF NOT EXISTS attribute_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attribute_points_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS physical_endurance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mental_focus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_presence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crowd_engagement integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_reach integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creativity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS technical integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS business integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS composition integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS musical_ability integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vocal_talent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rhythm_sense integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creative_insight integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS technical_mastery integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS business_acumen integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_savvy integer NOT NULL DEFAULT 0;

ALTER TABLE public.player_attributes
  DROP CONSTRAINT IF EXISTS player_attributes_profile_id_fkey,
  ADD CONSTRAINT player_attributes_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_attributes_profile_id
  ON public.player_attributes (profile_id);

ALTER TABLE public.player_attributes
  DROP CONSTRAINT IF EXISTS player_attributes_value_bounds;

ALTER TABLE public.player_attributes
  ADD CONSTRAINT player_attributes_value_bounds CHECK (
    physical_endurance BETWEEN 0 AND 1000 AND
    mental_focus BETWEEN 0 AND 1000 AND
    stage_presence BETWEEN 0 AND 1000 AND
    crowd_engagement BETWEEN 0 AND 1000 AND
    social_reach BETWEEN 0 AND 1000 AND
    creativity BETWEEN 0 AND 1000 AND
    technical BETWEEN 0 AND 1000 AND
    business BETWEEN 0 AND 1000 AND
    marketing BETWEEN 0 AND 1000 AND
    composition BETWEEN 0 AND 1000 AND
    musical_ability BETWEEN 0 AND 1000 AND
    vocal_talent BETWEEN 0 AND 1000 AND
    rhythm_sense BETWEEN 0 AND 1000 AND
    creative_insight BETWEEN 0 AND 1000 AND
    technical_mastery BETWEEN 0 AND 1000 AND
    business_acumen BETWEEN 0 AND 1000 AND
    marketing_savvy BETWEEN 0 AND 1000
  );

-- Weekly aggregation of player XP activity for dashboards and cadence systems
CREATE TABLE IF NOT EXISTS public.player_weekly_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  xp_earned integer NOT NULL DEFAULT 0,
  xp_spent integer NOT NULL DEFAULT 0,
  sessions_completed integer NOT NULL DEFAULT 0,
  quests_completed integer NOT NULL DEFAULT 0,
  rehearsals_logged integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT player_weekly_activity_unique_week UNIQUE (profile_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_player_weekly_activity_profile
  ON public.player_weekly_activity (profile_id);

CREATE INDEX IF NOT EXISTS idx_player_weekly_activity_week
  ON public.player_weekly_activity (week_start DESC);

-- Daily category rollups support streaks and balancing across activity types
CREATE TABLE IF NOT EXISTS public.player_daily_cats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  category text NOT NULL,
  xp_earned integer NOT NULL DEFAULT 0,
  xp_spent integer NOT NULL DEFAULT 0,
  activity_count integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT player_daily_cats_unique_day UNIQUE (profile_id, activity_date, category),
  CONSTRAINT player_daily_cats_valid_category CHECK (
    category = ANY (ARRAY['practice', 'performance', 'quest', 'social', 'other'])
  )
);

CREATE INDEX IF NOT EXISTS idx_player_daily_cats_profile
  ON public.player_daily_cats (profile_id);

CREATE INDEX IF NOT EXISTS idx_player_daily_cats_date
  ON public.player_daily_cats (activity_date DESC);

-- Attribute spend receipts provide a lightweight audit of player growth decisions
CREATE TABLE IF NOT EXISTS public.attribute_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  points_spent integer NOT NULL CHECK (points_spent > 0),
  xp_cost integer NOT NULL CHECK (xp_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb,
  CONSTRAINT attribute_spend_valid_key CHECK (
    attribute_key = ANY (
      ARRAY[
        'musical_ability',
        'vocal_talent',
        'rhythm_sense',
        'stage_presence',
        'creative_insight',
        'technical_mastery',
        'business_acumen',
        'marketing_savvy'
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_attribute_spend_profile
  ON public.attribute_spend (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attribute_spend_attribute
  ON public.attribute_spend (attribute_key);
