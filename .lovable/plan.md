

# Inbox Notifications for New Contract Offers (v1.0.852)

## Problem

Contract offers can arrive from multiple paths, but inbox notifications are inconsistent:

1. **ContractDesignerDialog** (label admin designing a custom offer) -- already sends an inbox notification, but only finds band leaders with `role = 'leader'`, missing users with `role = 'Founder'` or `'founder'`. Also does not notify solo artists (offers with `artist_profile_id` but no `band_id`).
2. **Database-seeded / NPC offers** -- inserted directly into `artist_label_contracts` with no notification trigger, so the player never knows they arrived.
3. **RequestContractDialog** (artist requesting a deal) -- no notification to the label owner that a request was received.

## Plan

### Step 1: Create a database trigger for automatic notifications

Create a PostgreSQL trigger function `notify_new_contract_offer()` that fires `AFTER INSERT` on `artist_label_contracts`. This covers all insertion paths (UI, NPC seeding, future automation) with a single mechanism.

The trigger will:
- Look up the label name from `labels`
- Determine the recipient: if `band_id` is set, find the band leader/founder's `user_id`; if `artist_profile_id` is set, find the profile's `user_id`
- Insert a `player_inbox` row with category `record_label`, priority `high`, a descriptive title and message including label name and advance amount, and `action_type = 'navigate'` with `action_data = '{"path": "/labels"}'`
- Only fire for offers with `status IN ('offered', 'pending')` (skip `active`, `rejected`, etc.)

### Step 2: Fix the band leader role query

Update the trigger (and existing code in `ContractDesignerDialog.tsx` and `LabelContractsTab.tsx`) to query band members with `role IN ('leader', 'Founder', 'founder', 'co-leader')` instead of just `'leader'`.

### Step 3: Add notification for label owner on inbound requests

In `RequestContractDialog.tsx`, after the successful contract insert, send a `player_inbox` notification to the label owner informing them of the incoming contract request.

### Step 4: Remove duplicate notification from ContractDesignerDialog

Since the DB trigger now handles the notification on insert, remove the manual `player_inbox.insert` block from `ContractDesignerDialog.tsx` to avoid double-notifying.

### Step 5: Update version to 1.0.852

Bump `VersionHeader.tsx` and add changelog entry in `VersionHistory.tsx`.

## Technical Details

**Trigger SQL (simplified):**
```sql
CREATE OR REPLACE FUNCTION notify_new_contract_offer()
RETURNS trigger AS $$
DECLARE
  v_label_name TEXT;
  v_recipient_id UUID;
  v_advance TEXT;
BEGIN
  IF NEW.status NOT IN ('offered', 'pending') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_label_name FROM labels WHERE id = NEW.label_id;

  IF NEW.band_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient_id FROM band_members
    WHERE band_id = NEW.band_id
      AND role IN ('leader','Founder','founder','co-leader')
    LIMIT 1;
  ELSIF NEW.artist_profile_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient_id FROM profiles
    WHERE id = NEW.artist_profile_id;
  END IF;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO player_inbox (user_id, category, priority, title, message,
      related_entity_id, related_entity_type, action_type, action_data)
    VALUES (
      v_recipient_id, 'record_label', 'high',
      'New Contract Offer!',
      COALESCE(v_label_name, 'A label') || ' wants to sign you! Advance: $' ||
        TO_CHAR(NEW.advance_amount, 'FM999,999,999') || '. Review in your contracts.',
      NEW.id, 'contract', 'navigate', '{"path":"/labels"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_contract_offer
  AFTER INSERT ON artist_label_contracts
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_contract_offer();
```

**Files to modify:**
- New SQL migration (trigger)
- `src/components/labels/management/ContractDesignerDialog.tsx` -- remove manual inbox insert (now handled by trigger)
- `src/components/labels/management/LabelContractsTab.tsx` -- fix role query in activation notification
- `src/components/labels/RequestContractDialog.tsx` -- add notification to label owner
- `src/components/VersionHeader.tsx` -- bump to 1.0.852
- `src/pages/VersionHistory.tsx` -- add changelog entry

