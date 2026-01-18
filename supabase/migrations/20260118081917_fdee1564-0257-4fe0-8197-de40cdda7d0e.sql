-- Comprehensive fix for infinite recursion in RLS policies

-- ============================================
-- Step 1: Drop ALL policies on companies table
-- ============================================
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies they work for" ON public.companies;
DROP POLICY IF EXISTS "VIP users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can delete their companies" ON public.companies;
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
DROP POLICY IF EXISTS "View companies" ON public.companies;
DROP POLICY IF EXISTS "Owner creates company" ON public.companies;
DROP POLICY IF EXISTS "Owner updates company" ON public.companies;
DROP POLICY IF EXISTS "Owner deletes company" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Company owners can update" ON public.companies;
DROP POLICY IF EXISTS "Company owners can delete" ON public.companies;
DROP POLICY IF EXISTS "companies_public_select" ON public.companies;
DROP POLICY IF EXISTS "companies_owner_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_owner_update" ON public.companies;
DROP POLICY IF EXISTS "companies_owner_delete" ON public.companies;

-- ============================================
-- Step 2: Create simple non-recursive policies for companies
-- ============================================
CREATE POLICY "companies_public_select" ON public.companies 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "companies_owner_insert" ON public.companies 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "companies_owner_update" ON public.companies 
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "companies_owner_delete" ON public.companies 
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- ============================================
-- Step 3: Fix venues table policies
-- ============================================
DROP POLICY IF EXISTS "Venues are viewable by everyone" ON public.venues;
DROP POLICY IF EXISTS "Company owners can view their venues" ON public.venues;
DROP POLICY IF EXISTS "venues_select_policy" ON public.venues;
DROP POLICY IF EXISTS "Venues are viewable by all" ON public.venues;
DROP POLICY IF EXISTS "Anyone can view venues" ON public.venues;
DROP POLICY IF EXISTS "Users can view venues" ON public.venues;
DROP POLICY IF EXISTS "View venues" ON public.venues;
DROP POLICY IF EXISTS "venues_public_select" ON public.venues;

CREATE POLICY "venues_public_select" ON public.venues 
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- Step 4: Fix city_studios table policies
-- ============================================
DROP POLICY IF EXISTS "City studios are viewable by everyone" ON public.city_studios;
DROP POLICY IF EXISTS "Company owners can view their studios" ON public.city_studios;
DROP POLICY IF EXISTS "View studios" ON public.city_studios;
DROP POLICY IF EXISTS "studios_select_policy" ON public.city_studios;
DROP POLICY IF EXISTS "studios_public_select" ON public.city_studios;
DROP POLICY IF EXISTS "Anyone can view studios" ON public.city_studios;

CREATE POLICY "studios_public_select" ON public.city_studios 
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- Step 5: Fix rehearsal_rooms table policies
-- ============================================
DROP POLICY IF EXISTS "Rehearsal rooms are viewable by everyone" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "Company owners can view their rehearsal rooms" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "View rehearsal rooms" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "rehearsals_select_policy" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "rehearsals_public_select" ON public.rehearsal_rooms;
DROP POLICY IF EXISTS "Anyone can view rehearsal rooms" ON public.rehearsal_rooms;

CREATE POLICY "rehearsals_public_select" ON public.rehearsal_rooms 
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- Step 6: Fix gig_outcomes.overall_rating constraint
-- ============================================
ALTER TABLE public.gig_outcomes ALTER COLUMN overall_rating DROP NOT NULL;
ALTER TABLE public.gig_outcomes ALTER COLUMN overall_rating SET DEFAULT 0;