-- Fix infinite recursion in companies RLS and missing columns in gig_outcomes

-- Step 1: Drop ALL policies on companies to eliminate recursion
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company owners can update" ON public.companies;
DROP POLICY IF EXISTS "Company owners can delete" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
DROP POLICY IF EXISTS "View companies" ON public.companies;
DROP POLICY IF EXISTS "Owner creates company" ON public.companies;
DROP POLICY IF EXISTS "Owner updates company" ON public.companies;
DROP POLICY IF EXISTS "Owner deletes company" ON public.companies;

-- Step 2: Create simple non-recursive policies for companies
CREATE POLICY "companies_select_policy"
ON public.companies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "companies_insert_policy"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "companies_update_policy"
ON public.companies FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "companies_delete_policy"
ON public.companies FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Step 3: Fix venues policies
DROP POLICY IF EXISTS "Venues are viewable by all" ON public.venues;
DROP POLICY IF EXISTS "Anyone can view venues" ON public.venues;
DROP POLICY IF EXISTS "Users can view venues" ON public.venues;
DROP POLICY IF EXISTS "View venues" ON public.venues;
DROP POLICY IF EXISTS "venues_select_policy" ON public.venues;

CREATE POLICY "venues_select_policy"
ON public.venues FOR SELECT
TO authenticated
USING (true);

-- Step 4: Add missing columns to gig_outcomes if they don't exist
DO $$
BEGIN
  -- Add venue_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'gig_outcomes' 
    AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE public.gig_outcomes ADD COLUMN venue_id uuid REFERENCES public.venues(id);
  END IF;
  
  -- Add band_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'gig_outcomes' 
    AND column_name = 'band_id'
  ) THEN
    ALTER TABLE public.gig_outcomes ADD COLUMN band_id uuid REFERENCES public.bands(id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gig_outcomes_venue_id ON public.gig_outcomes(venue_id);
CREATE INDEX IF NOT EXISTS idx_gig_outcomes_band_id ON public.gig_outcomes(band_id);