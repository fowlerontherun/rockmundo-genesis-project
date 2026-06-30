
ALTER TABLE public.company_storefront
  ADD COLUMN IF NOT EXISTS open_hour smallint NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS close_hour smallint NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS open_days text[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  ADD COLUMN IF NOT EXISTS sold_out_behavior text NOT NULL DEFAULT 'hide';

DO $$ BEGIN
  ALTER TABLE public.company_storefront
    ADD CONSTRAINT company_storefront_sold_out_behavior_check
    CHECK (sold_out_behavior IN ('hide','show_unavailable','backorder','substitute'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
