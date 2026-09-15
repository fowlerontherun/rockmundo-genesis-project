-- Keep the persisted tutorial destination aligned with the active rehearsal page.
UPDATE public.tutorial_steps
SET target_route = '/rehearsals'
WHERE step_key = 'book_rehearsal'
  AND target_route IS DISTINCT FROM '/rehearsals';
