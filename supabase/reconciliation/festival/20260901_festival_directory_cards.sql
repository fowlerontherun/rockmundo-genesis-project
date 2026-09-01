-- Clean-build parity overlay for the 2026-09-01 production Festival directory repair.
-- Runs after the repository's inherited Festival bootstrap has created the canonical
-- festival-company, edition and artist-booking tables.

CREATE OR REPLACE FUNCTION public.get_festival_directory_cards()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(card ORDER BY (card->>'startsOn')::date NULLS LAST, card->>'festivalName'),
    '[]'::jsonb
  )
  FROM (
    SELECT jsonb_build_object(
      'festivalCompanyId', fc.id,
      'festivalEditionId', e.id,
      'festivalName', coalesce(nullif(e.name, ''), fc.public_name),
      'slug', fc.slug,
      'tagline', fc.tagline,
      'description', fc.description,
      'status', e.status,
      'startsOn', e.starts_on,
      'endsOn', e.ends_on,
      'cityId', e.city_id,
      'cityName', c.name,
      'expectedCapacity', e.expected_capacity,
      'confirmedArtists', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ab.id,
            'name', coalesce(
              nullif(b.name, ''),
              nullif(p.display_name, ''),
              nullif(p.username, ''),
              'Confirmed artist'
            ),
            'billingPosition', ab.billing_position,
            'performanceDate', ab.provisional_date
          )
          ORDER BY
            CASE WHEN ab.billing_position = 'headliner' THEN 0 ELSE 1 END,
            ab.provisional_date NULLS LAST,
            coalesce(b.name, p.display_name, p.username)
        )
        FROM public.festival_artist_programmes ap
        JOIN public.festival_artist_bookings ab
          ON ab.festival_artist_programme_id = ap.id
        LEFT JOIN public.bands b ON b.id = ab.band_id
        LEFT JOIN public.profiles p ON p.id = ab.artist_profile_id
        WHERE ap.festival_edition_id = e.id
          AND ab.status = 'confirmed'
      ), '[]'::jsonb)
    ) AS card
    FROM public.festival_companies fc
    JOIN LATERAL (
      SELECT ev.*
      FROM public.festival_editions_v2 ev
      WHERE ev.festival_company_id = fc.id
        AND ev.starts_on IS NOT NULL
        AND ev.ends_on IS NOT NULL
        AND ev.ends_on >= current_date
        AND ev.status NOT IN ('cancelled', 'completed')
      ORDER BY ev.starts_on ASC, ev.created_at DESC
      LIMIT 1
    ) e ON true
    LEFT JOIN public.cities c ON c.id = e.city_id
    WHERE fc.status = 'active'
      AND fc.setup_completed = true
  ) cards;
$$;

REVOKE ALL ON FUNCTION public.get_festival_directory_cards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_festival_directory_cards() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
