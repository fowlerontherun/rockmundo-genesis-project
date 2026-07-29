-- Compatibility layer for the authoritative record-label schema created by the
-- consolidated 20250917090000 migration. Do not recreate tables or add a second
-- set of permissive RLS policies here.

ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.label_territories
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.label_roster_slots
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.artist_label_contracts(id) ON DELETE SET NULL;

-- These aliases remain in active use by the label directory and admin editor.
ALTER TABLE public.label_deal_types
  ADD COLUMN IF NOT EXISTS royalty_artist_pct integer,
  ADD COLUMN IF NOT EXISTS advance_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_max integer NOT NULL DEFAULT 0;

UPDATE public.label_deal_types
SET royalty_artist_pct = COALESCE(
  royalty_artist_pct,
  round(default_artist_royalty)::integer,
  20
)
WHERE royalty_artist_pct IS NULL;

ALTER TABLE public.label_deal_types
  ALTER COLUMN royalty_artist_pct SET DEFAULT 20,
  ALTER COLUMN royalty_artist_pct SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'label_deal_types_royalty_artist_pct_check'
      AND conrelid = 'public.label_deal_types'::regclass
  ) THEN
    ALTER TABLE public.label_deal_types
      ADD CONSTRAINT label_deal_types_royalty_artist_pct_check
      CHECK (royalty_artist_pct BETWEEN 0 AND 100)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'label_deal_types_advance_range_check'
      AND conrelid = 'public.label_deal_types'::regclass
  ) THEN
    ALTER TABLE public.label_deal_types
      ADD CONSTRAINT label_deal_types_advance_range_check
      CHECK (advance_min >= 0 AND advance_max >= advance_min)
      NOT VALID;
  END IF;
END
$$;

-- Preserve harmless aliases from the later label prototype without replacing
-- the canonical columns or automation.
ALTER TABLE public.artist_label_contracts
  ADD COLUMN IF NOT EXISTS marketing_support integer NOT NULL DEFAULT 0;

ALTER TABLE public.label_releases
  ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketing_budget integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_sold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_generated numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.label_releases
SET marketing_budget = COALESCE(marketing_budget, promotion_budget, 0),
    units_sold = COALESCE(units_sold, sales_units, 0),
    revenue_generated = COALESCE(revenue_generated, gross_revenue, 0)
WHERE marketing_budget IS NULL
   OR units_sold IS NULL
   OR revenue_generated IS NULL;

ALTER TABLE public.label_royalty_statements
  ADD COLUMN IF NOT EXISTS gross_revenue numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_deduction numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_payout numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.label_royalty_statements
SET gross_revenue = COALESCE(gross_revenue, artist_share + label_share, 0),
    net_payout = COALESCE(net_payout, artist_share, 0),
    created_at = COALESCE(created_at, generated_at, now())
WHERE gross_revenue IS NULL
   OR net_payout IS NULL
   OR created_at IS NULL;

-- Seed additional templates through both the canonical fields and the legacy
-- aliases. Use existence checks because historical data may not have a unique
-- constraint on name.
INSERT INTO public.label_deal_types (
  name,
  description,
  default_artist_royalty,
  default_label_royalty,
  includes_advance,
  includes_360,
  masters_owned_by_artist,
  default_term_months,
  default_release_quota,
  royalty_artist_pct,
  advance_min,
  advance_max
)
SELECT
  seed.name,
  seed.description,
  seed.artist_royalty,
  100 - seed.artist_royalty,
  seed.advance_max > 0,
  seed.includes_360,
  seed.artist_owns_masters,
  seed.term_months,
  seed.release_quota,
  seed.artist_royalty,
  seed.advance_min,
  seed.advance_max
FROM (VALUES
  ('Standard Deal'::text, 'Traditional recording contract with standard royalty split.'::text, 15, false, false, 24, 3, 10000, 50000),
  ('Distribution Deal'::text, 'Distribution-only agreement where the artist retains ownership.'::text, 30, false, true, 12, 1, 0, 10000),
  ('360 Deal'::text, 'Comprehensive deal covering multiple artist revenue streams.'::text, 10, true, false, 36, 4, 50000, 200000),
  ('Production Deal'::text, 'Label-funded production services and distribution.'::text, 20, false, false, 18, 2, 5000, 25000),
  ('Licensing Deal'::text, 'Short-term licensing agreement with artist-owned masters.'::text, 40, false, true, 12, 1, 0, 5000)
) AS seed(
  name,
  description,
  artist_royalty,
  includes_360,
  artist_owns_masters,
  term_months,
  release_quota,
  advance_min,
  advance_max
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.label_deal_types existing
  WHERE lower(existing.name) = lower(seed.name)
);

INSERT INTO public.territories (code, name, region)
SELECT *
FROM (VALUES
  ('US'::text, 'United States'::text, 'North America'::text),
  ('UK'::text, 'United Kingdom'::text, 'Europe'::text),
  ('CA'::text, 'Canada'::text, 'North America'::text),
  ('AU'::text, 'Australia'::text, 'Oceania'::text),
  ('JP'::text, 'Japan'::text, 'Asia'::text),
  ('DE'::text, 'Germany'::text, 'Europe'::text),
  ('FR'::text, 'France'::text, 'Europe'::text),
  ('BR'::text, 'Brazil'::text, 'South America'::text),
  ('MX'::text, 'Mexico'::text, 'North America'::text),
  ('IT'::text, 'Italy'::text, 'Europe'::text),
  ('ES'::text, 'Spain'::text, 'Europe'::text),
  ('KR'::text, 'South Korea'::text, 'Asia'::text),
  ('CN'::text, 'China'::text, 'Asia'::text),
  ('IN'::text, 'India'::text, 'Asia'::text),
  ('WORLDWIDE'::text, 'Worldwide'::text, 'Global'::text)
) seed(code, name, region)
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
