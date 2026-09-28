ALTER TABLE public.avatar_v2_authoring_reviews
  DROP CONSTRAINT IF EXISTS avatar_v2_authoring_reviews_status_check;
ALTER TABLE public.avatar_v2_authoring_reviews
  ADD CONSTRAINT avatar_v2_authoring_reviews_status_check
  CHECK (status IN ('source_verified', 'staged_for_review', 'rejected'));
