-- Add release_id to dikcok_videos
ALTER TABLE public.dikcok_videos
ADD COLUMN release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL;

-- Add linked_release_id to all 4 media submission tables
ALTER TABLE public.newspaper_submissions
ADD COLUMN linked_release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL;

ALTER TABLE public.magazine_submissions
ADD COLUMN linked_release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL;

ALTER TABLE public.podcast_submissions
ADD COLUMN linked_release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL;

ALTER TABLE public.website_submissions
ADD COLUMN linked_release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL;