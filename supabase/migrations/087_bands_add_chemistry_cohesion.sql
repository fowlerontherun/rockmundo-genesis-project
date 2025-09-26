-- Migration 087: Add chemistry and cohesion attributes to bands

ALTER TABLE public.bands
  ADD COLUMN chemistry integer NOT NULL DEFAULT 20,
  ADD COLUMN cohesion integer NOT NULL DEFAULT 20;

ALTER TABLE public.bands
  ADD CONSTRAINT bands_chemistry_range CHECK (chemistry BETWEEN 0 AND 100),
  ADD CONSTRAINT bands_cohesion_range CHECK (cohesion BETWEEN 0 AND 100);
