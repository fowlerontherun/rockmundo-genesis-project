-- Fix infinite recursion in companies RLS policies
-- Drop problematic policies and recreate with simpler logic

-- First, drop all existing policies on companies table
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company owners can update" ON public.companies;
DROP POLICY IF EXISTS "Company owners can delete" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;

-- Recreate simple, non-recursive policies
-- Allow all authenticated users to view companies (no joins that could cause recursion)
CREATE POLICY "View companies"
ON public.companies FOR SELECT
TO authenticated
USING (true);

-- Only owner can insert
CREATE POLICY "Owner creates company"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Only owner can update
CREATE POLICY "Owner updates company"
ON public.companies FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Only owner can delete
CREATE POLICY "Owner deletes company"
ON public.companies FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Fix venues policies that might reference companies
DROP POLICY IF EXISTS "Venues are viewable by all" ON public.venues;
DROP POLICY IF EXISTS "Anyone can view venues" ON public.venues;
DROP POLICY IF EXISTS "Users can view venues" ON public.venues;

CREATE POLICY "View venues"
ON public.venues FOR SELECT
TO authenticated
USING (true);

-- Fix city_studios policies
DROP POLICY IF EXISTS "Studios are viewable by all" ON public.city_studios;
DROP POLICY IF EXISTS "Anyone can view studios" ON public.city_studios;
DROP POLICY IF EXISTS "Users can view studios" ON public.city_studios;

CREATE POLICY "View studios"
ON public.city_studios FOR SELECT
TO authenticated
USING (true);

-- Fix rehearsal_rooms policies
DROP POLICY IF EXISTS "Rehearsal rooms are viewable by all" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "Anyone can view rehearsal rooms" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "Users can view rehearsal rooms" ON public.rehearsal_rooms;

CREATE POLICY "View rehearsal rooms"
ON public.rehearsal_rooms FOR SELECT
TO authenticated
USING (true);

-- Add band_id to gig_outcomes if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'gig_outcomes' 
    AND column_name = 'band_id'
  ) THEN
    ALTER TABLE public.gig_outcomes ADD COLUMN band_id uuid REFERENCES public.bands(id);
    CREATE INDEX IF NOT EXISTS idx_gig_outcomes_band_id ON public.gig_outcomes(band_id);
  END IF;
END $$;