-- Balance the ORIGINAL 100 legacy interview questions with modern interviews.
-- The original questions had 0.50-1.40 fame/fan modifiers and reputation
-- swings as large as +/-8, while later content has small incremental effects.
-- Multipliers move only 20% of their prior distance from 1.00; reputation
-- retains its original axis keys and polarity, but is capped at +/-3.
-- All options are transformed together. Safe to replay: once modernised,
-- no effect multiplier remains outside [0.90, 1.10].
WITH balanced AS (
 UPDATE public.interview_questions AS q SET
 option_a_effects = jsonb_set(jsonb_set(jsonb_set(jsonb_set(q.option_a_effects,'{fame_mult}',to_jsonb(round((1 + ((q.option_a_effects->>'fame_mult')::numeric - 1) * 0.20)::numeric, 2))),'{fan_mult}',to_jsonb(round((1 + ((q.option_a_effects->>'fan_mult')::numeric - 1) * 0.20)::numeric, 2))),'{cash_mult}',to_jsonb(round((1 + ((q.option_a_effects->>'cash_mult')::numeric - 1) * 0.20)::numeric, 2))),'{reputation}',COALESCE((
 SELECT jsonb_object_agg(k, to_jsonb(
  CASE WHEN v::numeric=0 THEN 0
  ELSE (sign(v::numeric) * greatest(1,least(3,round(abs(v::numeric) * 0.40))))::integer END
 ))
 FROM jsonb_each_text(q.option_a_effects->'reputation') AS reputation_axis(k,v)
 ), '{}'::jsonb)),
option_b_effects = jsonb_set(jsonb_set(jsonb_set(jsonb_set(q.option_b_effects,'{fame_mult}',to_jsonb(round((1 + ((q.option_b_effects->>'fame_mult')::numeric - 1) * 0.20)::numeric, 2))),'{fan_mult}',to_jsonb(round((1 + ((q.option_b_effects->>'fan_mult')::numeric - 1) * 0.20)::numeric, 2))),'{cash_mult}',to_jsonb(round((1 + ((q.option_b_effects->>'cash_mult')::numeric - 1) * 0.20)::numeric, 2))),'{reputation}',COALESCE((
 SELECT jsonb_object_agg(k, to_jsonb(
  CASE WHEN v::numeric=0 THEN 0
  ELSE (sign(v::numeric) * greatest(1,least(3,round(abs(v::numeric) * 0.40))))::integer END
 ))
 FROM jsonb_each_text(q.option_b_effects->'reputation') AS reputation_axis(k,v)
 ), '{}'::jsonb)),
option_c_effects = jsonb_set(jsonb_set(jsonb_set(jsonb_set(q.option_c_effects,'{fame_mult}',to_jsonb(round((1 + ((q.option_c_effects->>'fame_mult')::numeric - 1) * 0.20)::numeric, 2))),'{fan_mult}',to_jsonb(round((1 + ((q.option_c_effects->>'fan_mult')::numeric - 1) * 0.20)::numeric, 2))),'{cash_mult}',to_jsonb(round((1 + ((q.option_c_effects->>'cash_mult')::numeric - 1) * 0.20)::numeric, 2))),'{reputation}',COALESCE((
 SELECT jsonb_object_agg(k, to_jsonb(
  CASE WHEN v::numeric=0 THEN 0
  ELSE (sign(v::numeric) * greatest(1,least(3,round(abs(v::numeric) * 0.40))))::integer END
 ))
 FROM jsonb_each_text(q.option_c_effects->'reputation') AS reputation_axis(k,v)
 ), '{}'::jsonb)),
option_d_effects = jsonb_set(jsonb_set(jsonb_set(jsonb_set(q.option_d_effects,'{fame_mult}',to_jsonb(round((1 + ((q.option_d_effects->>'fame_mult')::numeric - 1) * 0.20)::numeric, 2))),'{fan_mult}',to_jsonb(round((1 + ((q.option_d_effects->>'fan_mult')::numeric - 1) * 0.20)::numeric, 2))),'{cash_mult}',to_jsonb(round((1 + ((q.option_d_effects->>'cash_mult')::numeric - 1) * 0.20)::numeric, 2))),'{reputation}',COALESCE((
 SELECT jsonb_object_agg(k, to_jsonb(
  CASE WHEN v::numeric=0 THEN 0
  ELSE (sign(v::numeric) * greatest(1,least(3,round(abs(v::numeric) * 0.40))))::integer END
 ))
 FROM jsonb_each_text(q.option_d_effects->'reputation') AS reputation_axis(k,v)
 ), '{}'::jsonb))
 WHERE q.created_at::date=DATE '2026-02-14'
 AND (((option_a_effects->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_a_effects->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_a_effects->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.10) OR
((option_b_effects->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_b_effects->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_b_effects->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.10) OR
((option_c_effects->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_c_effects->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_c_effects->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.10) OR
((option_d_effects->>'fame_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_d_effects->>'fan_mult')::numeric NOT BETWEEN 0.90 AND 1.10 OR (option_d_effects->>'cash_mult')::numeric NOT BETWEEN 0.90 AND 1.10))
 RETURNING q.id
) SELECT COUNT(*)::integer AS balanced_questions FROM balanced;