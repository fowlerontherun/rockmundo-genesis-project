UPDATE public.band_members bm
SET profile_id = expected.profile_id
FROM (VALUES
  ('b0c2435c-7aae-46c6-9806-215626c29420'::uuid, '69e017e7-8bfb-4eb6-ae45-a0c56f0b0a8e'::uuid),
  ('0ad21de3-4e71-49de-a641-5c4f48165c2b'::uuid, '08bde4fa-689b-486c-82e3-afd18c166deb'::uuid),
  ('ccfe0028-9d29-4b7a-b21a-b995eee0e59e'::uuid, '8c8a7d7c-8925-483b-ba3f-3be4df497e85'::uuid)
) AS expected(member_id, profile_id)
WHERE bm.id = expected.member_id
  AND bm.band_id = '3b6c8c60-7e8e-456d-858a-d6f1dcb9a296'::uuid
  AND bm.profile_id IS DISTINCT FROM expected.profile_id;