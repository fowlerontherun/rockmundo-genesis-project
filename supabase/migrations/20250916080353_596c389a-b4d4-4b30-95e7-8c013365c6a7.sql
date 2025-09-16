-- Fix security linter warnings by adding search_path to functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, 
          COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
          COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'));
  
  -- Create initial skills
  INSERT INTO public.player_skills (user_id)
  VALUES (NEW.id);

  -- Create initial activity
  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;