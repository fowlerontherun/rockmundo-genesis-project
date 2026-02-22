
-- Create trigger function to notify on new contract offers
CREATE OR REPLACE FUNCTION public.notify_new_contract_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_label_name TEXT;
  v_recipient_id UUID;
BEGIN
  -- Only notify for new offers/pending requests
  IF NEW.status NOT IN ('offered', 'pending') THEN
    RETURN NEW;
  END IF;

  -- Get label name
  SELECT name INTO v_label_name FROM labels WHERE id = NEW.label_id;

  -- Determine recipient
  IF NEW.band_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient_id FROM band_members
    WHERE band_id = NEW.band_id
      AND role IN ('leader', 'Founder', 'founder', 'co-leader')
      AND user_id IS NOT NULL
    LIMIT 1;
  ELSIF NEW.artist_profile_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient_id FROM profiles
    WHERE id = NEW.artist_profile_id;
  END IF;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO player_inbox (user_id, category, priority, title, message,
      related_entity_id, related_entity_type, action_type, action_data)
    VALUES (
      v_recipient_id,
      'record_label',
      'high',
      '📝 New Contract Offer!',
      COALESCE(v_label_name, 'A label') || ' wants to sign you! Advance: $' ||
        TO_CHAR(COALESCE(NEW.advance_amount, 0), 'FM999,999,999') || '. Review in your contracts.',
      NEW.id::text,
      'contract',
      'navigate',
      '{"path":"/labels"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_new_contract_offer
  AFTER INSERT ON artist_label_contracts
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_contract_offer();
