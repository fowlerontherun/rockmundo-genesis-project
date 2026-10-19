-- Production receipt 20261019165415: verified band representations may vote.
-- Service-run NPC/jury paths remain permitted as before.
ALTER TABLE public.award_votes
  DROP CONSTRAINT IF EXISTS award_votes_voter_type_check;
ALTER TABLE public.award_votes
  ADD CONSTRAINT award_votes_voter_type_check
  CHECK (voter_type IN ('player','band','npc','jury'));
