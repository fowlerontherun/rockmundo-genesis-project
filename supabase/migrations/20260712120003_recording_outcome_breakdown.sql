-- Recording outcome v1 persistence. Existing rows keep their historical quality and are marked legacy lazily.
ALTER TABLE public.recording_sessions
  ADD COLUMN IF NOT EXISTS calculation_version text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS source_song_quality integer,
  ADD COLUMN IF NOT EXISTS final_master_quality integer,
  ADD COLUMN IF NOT EXISTS applied_variance numeric,
  ADD COLUMN IF NOT EXISTS outcome_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recording_credits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS xp_awards jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.recording_sessions.calculation_version IS 'Recording outcome balance version. Legacy rows preserve existing quality and are not rerolled.';
COMMENT ON COLUMN public.recording_sessions.source_song_quality IS 'Songwriting/source material quality captured before recording outcome calculation.';
COMMENT ON COLUMN public.recording_sessions.final_master_quality IS 'Server-authoritative final master score after staged recording calculation.';
COMMENT ON COLUMN public.recording_sessions.applied_variance IS 'Stored bounded deterministic variance applied at completion for idempotent non-rerollable outcomes.';
COMMENT ON COLUMN public.recording_sessions.outcome_breakdown IS 'Structured recording outcome breakdown: performers, readiness, studio, producer, engineer, duration, mode and warnings.';
COMMENT ON COLUMN public.recording_sessions.recording_credits IS 'Credits and contribution records for performers, producer, engineer, session musicians and studio.';
COMMENT ON COLUMN public.recording_sessions.xp_awards IS 'Server-generated XP awards for recording participants and professional roles.';

UPDATE public.recording_sessions
SET calculation_version = 'legacy',
    final_master_quality = COALESCE(final_master_quality, quality_improvement),
    outcome_breakdown = CASE WHEN outcome_breakdown = '{}'::jsonb THEN jsonb_build_object('legacy', true) ELSE outcome_breakdown END
WHERE status = 'completed'
  AND COALESCE(calculation_version, 'legacy') = 'legacy';
