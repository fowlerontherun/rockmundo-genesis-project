-- Keep the persisted tutorial destination aligned with the current band hub route.
UPDATE public.tutorial_steps
SET target_route = '/band/rehearsals'
WHERE step_key = 'book_rehearsal'
  AND target_route IS DISTINCT FROM '/band/rehearsals';
