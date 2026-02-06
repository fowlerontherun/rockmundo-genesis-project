-- Fix search path for the new vote count function
CREATE OR REPLACE FUNCTION public.update_nomination_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.award_nominations 
  SET vote_count = (SELECT COALESCE(SUM(weight), 0) FROM public.award_votes WHERE nomination_id = NEW.nomination_id)
  WHERE id = NEW.nomination_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;