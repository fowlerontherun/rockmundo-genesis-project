-- Compatibility shim for the historical nightclub seed that follows.
-- The original seed hard-coded city UUIDs from an older dataset. Fresh
-- databases now generate/use different canonical city IDs, so translate the
-- legacy IDs to the current city row by stable city name before FK checks run.

CREATE OR REPLACE FUNCTION public.remap_legacy_nightclub_city_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_city_name text;
  v_city_id uuid;
BEGIN
  v_city_name := CASE NEW.city_id
    WHEN '9a2e587a-94f7-49ec-8c99-21f95cac5860'::uuid THEN 'Birmingham'
    WHEN 'f082fb21-717b-4abb-af6e-8cb5556dd072'::uuid THEN 'Edinburgh'
    WHEN '5030bf72-9301-4b8a-80f3-123e72bdb117'::uuid THEN 'Liverpool'
    WHEN '9120351f-07d6-4b6a-bc64-6914d90540a1'::uuid THEN 'Glasgow'
    WHEN 'f3606ebd-278a-4bfc-8023-d9f9ebfedbf5'::uuid THEN 'Bristol'
    WHEN 'ab2f6f73-8bd4-4adb-aee4-d123ce1a2cd3'::uuid THEN 'Leeds'
    WHEN '50a1c6e7-b9ee-44f0-95c4-8453396728ed'::uuid THEN 'Brighton'
    WHEN 'd66d819a-62fa-4594-a796-7e8f5ed53284'::uuid THEN 'Cardiff'
    WHEN 'efbe74b2-913c-4585-877b-d3ba64f9348f'::uuid THEN 'Newcastle'
    WHEN '83822ef1-93c9-46f0-85d0-de8f3d2433f4'::uuid THEN 'Sheffield'
    WHEN '96e8e64a-11af-4f9c-a018-9ff9e4c6fd13'::uuid THEN 'Belfast'
    WHEN '71bf8418-38af-443d-9e3f-80458b2d04a9'::uuid THEN 'Nottingham'
    WHEN 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a'::uuid THEN 'New York'
    WHEN 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a'::uuid THEN 'Los Angeles'
    WHEN '96c964de-4dbd-4bbe-80b7-6c9f68d4ba32'::uuid THEN 'Miami'
    WHEN '29809134-e947-408b-9786-6d7b51181548'::uuid THEN 'Chicago'
    WHEN '4efac643-c3bf-40b6-adcb-c3d5242c7b23'::uuid THEN 'Las Vegas'
    WHEN 'cc1fd801-c4b3-448f-ad55-f307e10e14a0'::uuid THEN 'Berlin'
    WHEN 'de4787a9-f69a-44d8-8747-1cb02cae0c1c'::uuid THEN 'Amsterdam'
    WHEN '6c2386aa-a874-4c36-b153-8e10376f4a6e'::uuid THEN 'Barcelona'
    WHEN '13d450a9-eab3-430c-b5d1-377e5d3f2539'::uuid THEN 'Paris'
    WHEN '82ad6e5d-96a9-40a1-9cfc-b3cc256d1b4a'::uuid THEN 'Ibiza'
    WHEN 'e798f1af-0b63-46a5-aa31-1a634b1c475f'::uuid THEN 'Prague'
    WHEN '31f54d08-a832-417a-8db1-3f0900e11b6a'::uuid THEN 'Dublin'
    WHEN 'cb90acc2-068d-4cb8-9371-5a2e1843e3e6'::uuid THEN 'Lisbon'
    WHEN '2e670249-4f15-4089-b3cf-a1c2545bb5fa'::uuid THEN 'Stockholm'
    WHEN '9a2cbfe1-cd41-4f68-a385-2e792714afe5'::uuid THEN 'Copenhagen'
    WHEN '3a32d826-cead-4d80-a829-87abda80d991'::uuid THEN 'Vienna'
    WHEN '89b8b930-4fce-4776-a470-8943364ea120'::uuid THEN 'Tokyo'
    WHEN '65b3346d-0fc9-4319-b711-84a3d553d22b'::uuid THEN 'Seoul'
    WHEN 'bbfcf4ba-3d9f-44ab-8413-dd04236174be'::uuid THEN 'Bangkok'
    WHEN '0c9c8a7e-c6b4-4927-932a-8491c2b40a06'::uuid THEN 'Rio de Janeiro'
    WHEN '03074fa3-94d0-450d-9520-092f3461daab'::uuid THEN 'Buenos Aires'
    WHEN '06a16e6b-5888-4046-90d8-dfca01eda238'::uuid THEN 'Sydney'
    WHEN '2d9e6eca-87f9-45c4-8d19-b431032ea46b'::uuid THEN 'Cape Town'
    WHEN '2a518758-067c-4d34-8ff6-666a31169fe7'::uuid THEN 'Nashville'
    WHEN '8215d23e-5714-478e-9ac8-b7b82994fdc6'::uuid THEN 'Austin'
    WHEN '73fae343-9a12-4ecb-867f-ad6ec3699364'::uuid THEN 'San Francisco'
    WHEN '872150e0-6fa6-4150-b622-b0f8e60ea6fb'::uuid THEN 'Atlanta'
    WHEN '0f6c3eea-29c4-443b-b505-171a6d97c3f5'::uuid THEN 'Detroit'
    WHEN '37e3030a-2f21-4d37-985c-4660360665ca'::uuid THEN 'Boston'
    WHEN '5c8b81fd-519b-4f7b-99e5-0a7d0f7b482f'::uuid THEN 'Philadelphia'
    ELSE NULL
  END;

  IF v_city_name IS NOT NULL THEN
    SELECT id
      INTO v_city_id
      FROM public.cities
     WHERE lower(name) = lower(v_city_name)
     LIMIT 1;

    IF v_city_id IS NULL THEN
      RAISE EXCEPTION 'Nightclub seed expected canonical city %, but it was not found', v_city_name;
    END IF;

    NEW.city_id := v_city_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remap_legacy_nightclub_city_id ON public.city_night_clubs;
CREATE TRIGGER remap_legacy_nightclub_city_id
BEFORE INSERT ON public.city_night_clubs
FOR EACH ROW
EXECUTE FUNCTION public.remap_legacy_nightclub_city_id();
