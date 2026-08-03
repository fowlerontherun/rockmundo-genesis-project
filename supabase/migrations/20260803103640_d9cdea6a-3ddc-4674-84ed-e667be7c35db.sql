UPDATE public.band_members
SET member_status = 'active',
    is_touring_member = false
WHERE band_id = '3b6c8c60-7e8e-456d-858a-d6f1dcb9a296'::uuid
  AND profile_id IN (
    '69e017e7-8bfb-4eb6-ae45-a0c56f0b0a8e'::uuid,
    '08bde4fa-689b-486c-82e3-afd18c166deb'::uuid,
    '8c8a7d7c-8925-483b-ba3f-3be4df497e85'::uuid
  );