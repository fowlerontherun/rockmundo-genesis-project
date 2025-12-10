-- Create limited public view for player discovery (fixed column name)
CREATE OR REPLACE VIEW public.public_player_cards AS
SELECT 
  id,
  user_id,
  username,
  display_name,
  avatar_url,
  fame,
  level,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_player_cards TO authenticated;
GRANT SELECT ON public.public_player_cards TO anon;