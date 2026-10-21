-- Run against a disposable or read-only test database after the interview
-- catalogue migrations. Raises an error on repeated/empty/misaligned choices.
DO $test$
DECLARE
  question_count integer;
  distinct_question_count integer;
  answer_set_count integer;
  malformed_count integer;
  repaired_count integer;
BEGIN
  SELECT count(*), count(DISTINCT question_text),
         count(DISTINCT (option_a_text,option_b_text,option_c_text,option_d_text))
    INTO question_count, distinct_question_count, answer_set_count
    FROM public.interview_questions;

  SELECT count(*) INTO malformed_count
    FROM public.interview_questions
    WHERE btrim(question_text) = ''
       OR btrim(option_a_text) = '' OR btrim(option_b_text) = ''
       OR btrim(option_c_text) = '' OR btrim(option_d_text) = ''
       OR lower(btrim(option_a_text)) IN (lower(btrim(option_b_text)),lower(btrim(option_c_text)),lower(btrim(option_d_text)))
       OR lower(btrim(option_b_text)) IN (lower(btrim(option_c_text)),lower(btrim(option_d_text)))
       OR lower(btrim(option_c_text)) = lower(btrim(option_d_text));

  SELECT count(*) INTO repaired_count
    FROM public.interview_questions
    WHERE created_at::date = DATE '2026-09-02';

  IF question_count <> distinct_question_count OR malformed_count > 0 THEN
    RAISE EXCEPTION 'Invalid interview questions: total %, unique %, malformed %',
      question_count, distinct_question_count, malformed_count;
  END IF;
  IF answer_set_count <> question_count THEN
    RAISE EXCEPTION 'Reused interview answer sets found: % sets for % questions',
      answer_set_count, question_count;
  END IF;
  IF repaired_count <> 200 OR question_count < 300 THEN
    RAISE EXCEPTION 'Interview content incomplete: repaired %, total %',
      repaired_count, question_count;
  END IF;
END;
$test$;
