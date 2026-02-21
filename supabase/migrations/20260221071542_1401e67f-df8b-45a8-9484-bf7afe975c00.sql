
-- Seed character_relationships for the user's existing accepted friendships
-- User profile_id: 26f2d914-849a-4377-95b3-389d6bc7815d

-- Friendship with Poppy (accepted friend)
INSERT INTO character_relationships (entity_a_id, entity_a_type, entity_b_id, entity_b_type, entity_b_name, relationship_types, affection_score, trust_score, attraction_score, loyalty_score, jealousy_score, visibility, last_interaction_at)
VALUES 
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', '0882ec00-fa13-4c37-b3c0-6c184804763e', 'player', 'Poppy', ARRAY['friend'], 45, 55, 20, 40, 5, 'public', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Reverse relationship for Poppy
INSERT INTO character_relationships (entity_a_id, entity_a_type, entity_b_id, entity_b_type, entity_b_name, relationship_types, affection_score, trust_score, attraction_score, loyalty_score, jealousy_score, visibility, last_interaction_at)
VALUES 
  ('0882ec00-fa13-4c37-b3c0-6c184804763e', 'player', '26f2d914-849a-4377-95b3-389d6bc7815d', 'player', 'Big Fowler', ARRAY['friend'], 45, 55, 20, 40, 5, 'public', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Seed NPC relationships for the user
-- These are game NPCs the player has interacted with through gameplay
INSERT INTO character_relationships (entity_a_id, entity_a_type, entity_b_id, entity_b_type, entity_b_name, relationship_types, affection_score, trust_score, attraction_score, loyalty_score, jealousy_score, visibility, last_interaction_at)
VALUES
  -- Music industry NPCs
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Johnny Blaze', ARRAY['rival'], -20, 15, 10, 5, 65, 'public', NOW() - INTERVAL '5 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Vera Songbird', ARRAY['mentor'], 60, 80, 15, 70, 0, 'public', NOW() - INTERVAL '1 day'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'DJ Scratch', ARRAY['collaborator', 'friend'], 50, 60, 5, 45, 10, 'public', NOW() - INTERVAL '3 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Luna Nightshade', ARRAY['partner'], 85, 70, 90, 75, 20, 'private', NOW() - INTERVAL '6 hours'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Rex Thunders', ARRAY['bandmate', 'friend'], 55, 65, 10, 60, 15, 'public', NOW() - INTERVAL '12 hours'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Zara Flames', ARRAY['ex_partner'], 10, 20, 50, 15, 70, 'leaked', NOW() - INTERVAL '14 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Marcus Gold', ARRAY['business_contact'], 30, 75, 0, 50, 0, 'public', NOW() - INTERVAL '4 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Ivy Chen', ARRAY['protege'], 65, 55, 25, 45, 5, 'public', NOW() - INTERVAL '2 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'The Phantom', ARRAY['nemesis'], -60, 5, 0, 0, 80, 'public', NOW() - INTERVAL '7 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Melody Rivers', ARRAY['fan', 'friend'], 40, 35, 30, 25, 10, 'public', NOW() - INTERVAL '10 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Santiago Cruz', ARRAY['rival', 'collaborator'], -5, 40, 15, 20, 45, 'public', NOW() - INTERVAL '8 days'),
  ('26f2d914-849a-4377-95b3-389d6bc7815d', 'player', gen_random_uuid(), 'npc', 'Nikki Voltage', ARRAY['close_friend', 'bandmate'], 70, 80, 35, 85, 10, 'public', NOW() - INTERVAL '1 day');

-- Create trigger to auto-sync accepted friendships to character_relationships
CREATE OR REPLACE FUNCTION public.sync_friendship_to_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requestor_profile_id UUID;
  v_addressee_profile_id UUID;
  v_requestor_name TEXT;
  v_addressee_name TEXT;
BEGIN
  -- Only process when friendship is accepted
  IF NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted') THEN
    -- Get profile IDs and names
    SELECT id, display_name INTO v_requestor_profile_id, v_requestor_name
    FROM profiles WHERE user_id = NEW.requestor_id;
    
    SELECT id, display_name INTO v_addressee_profile_id, v_addressee_name
    FROM profiles WHERE user_id = NEW.addressee_id;
    
    IF v_requestor_profile_id IS NOT NULL AND v_addressee_profile_id IS NOT NULL THEN
      -- Create A->B relationship
      INSERT INTO character_relationships (entity_a_id, entity_a_type, entity_b_id, entity_b_type, entity_b_name, relationship_types, affection_score, trust_score, attraction_score, loyalty_score, jealousy_score, visibility, last_interaction_at)
      VALUES (v_requestor_profile_id, 'player', v_addressee_profile_id, 'player', v_addressee_name, ARRAY['friend'], 30, 30, 10, 20, 0, 'public', NOW())
      ON CONFLICT DO NOTHING;
      
      -- Create B->A relationship
      INSERT INTO character_relationships (entity_a_id, entity_a_type, entity_b_id, entity_b_type, entity_b_name, relationship_types, affection_score, trust_score, attraction_score, loyalty_score, jealousy_score, visibility, last_interaction_at)
      VALUES (v_addressee_profile_id, 'player', v_requestor_profile_id, 'player', v_requestor_name, ARRAY['friend'], 30, 30, 10, 20, 0, 'public', NOW())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS on_friendship_accepted ON friendships;
CREATE TRIGGER on_friendship_accepted
  AFTER INSERT OR UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION sync_friendship_to_relationships();
