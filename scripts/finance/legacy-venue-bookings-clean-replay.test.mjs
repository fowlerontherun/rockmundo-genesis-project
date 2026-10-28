import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = (name) => readFileSync(
  new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8',
);

const legacyBookings = migration('20250919133739_add_venue_support_structures.sql');
const companyVenues = migration('20260117192120_f009e2aa-e4a8-4e6e-bda3-95d5a7de41d8.sql');

test('January company venue policies work with September user-owned bookings on clean replay', async () => {
  const legacyTable = legacyBookings.match(
    /CREATE TABLE IF NOT EXISTS public\.venue_bookings\s*\([\s\S]*?\n\);/,
  )?.[0];
  assert.ok(legacyTable, 'Use the real September booking table definition');
  assert.match(companyVenues, /ADD COLUMN IF NOT EXISTS band_id uuid/);
  assert.match(companyVenues, /ADD COLUMN IF NOT EXISTS booking_date date/);
  assert.match(companyVenues, /CREATE POLICY "Venue owners can view bookings"/);

  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE TABLE public.companies (
        id uuid PRIMARY KEY, owner_id uuid
      );
      CREATE TABLE public.venues (id uuid PRIMARY KEY);
      CREATE TABLE public.bands (id uuid PRIMARY KEY);
      CREATE TABLE public.gigs (id uuid PRIMARY KEY);
      CREATE TABLE public.band_members (band_id uuid, user_id uuid);
      CREATE FUNCTION public.update_updated_at_column()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
    `);
    await db.exec(legacyTable);

    const venueId = '00000000-0000-0000-0000-000000000011';
    const userId = '00000000-0000-0000-0000-000000000021';
    const bandId = '00000000-0000-0000-0000-000000000031';
    await db.query('INSERT INTO public.venues(id) VALUES ($1)', [venueId]);
    await db.query('INSERT INTO public.bands(id) VALUES ($1)', [bandId]);
    await db.query(
      `INSERT INTO public.venue_bookings
        (venue_id, user_id, event_date, status, notes)
        VALUES ($1, $2, '2026-03-12T20:00:00Z', 'pending', 'Legacy record')`,
      [venueId, userId],
    );

    // Execute the actual January migration, including all RLS policies and
    // indexes. A missing band_id fails here with SQLSTATE 42703.
    await db.exec(companyVenues);

    const { rows: existing } = await db.query(`SELECT user_id, event_date,
      booking_date::text AS booking_date, booking_type, notes FROM public.venue_bookings
      WHERE notes = 'Legacy record'`);
    assert.equal(existing.length, 1);
    assert.equal(existing[0].user_id, userId);
    assert.equal(existing[0].booking_date, '2026-03-12');
    assert.equal(existing[0].booking_type, 'gig');
    assert.equal(existing[0].notes, 'Legacy record');

    await db.query(`INSERT INTO public.venue_bookings (
      venue_id, user_id, band_id, booking_date, booking_type, notes
    ) VALUES ($1, $2, $3, '2026-03-13', 'gig', 'Band booking')`,
    [venueId, userId, bandId]);
    const { rows: modern } = await db.query(`SELECT band_id, booking_date::text AS booking_date,
      user_id FROM public.venue_bookings WHERE notes = 'Band booking'`);
    assert.equal(modern[0].band_id, bandId);
    assert.equal(modern[0].booking_date, '2026-03-13');
    assert.equal(modern[0].user_id, userId);

    const { rows: policies } = await db.query(`SELECT policyname
      FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'venue_bookings'`);
    assert.ok(policies.some((policy) =>
      policy.policyname === 'Venue owners can view bookings'));
    assert.ok(policies.some((policy) =>
      policy.policyname === 'Venue owners can manage bookings'));
  } finally {
    await db.close();
  }
});
