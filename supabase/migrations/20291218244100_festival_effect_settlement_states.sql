ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'calculating_outcomes';
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'outcomes_calculated';
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'applying_outcomes';
ALTER TYPE public.festival_edition_settlement_state ADD VALUE IF NOT EXISTS 'effects_complete';
