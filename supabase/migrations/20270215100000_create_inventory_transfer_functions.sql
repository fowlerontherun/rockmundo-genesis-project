BEGIN;

-- Create enum for transfer status values if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'inventory_transfer_status'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.inventory_transfer_status AS ENUM ('completed', 'acknowledged');
  END IF;
END;
$$;

-- Table to capture inventory transfer events between profiles
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_table text NOT NULL,
  item_id uuid NOT NULL,
  item_snapshot jsonb,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.inventory_transfer_status NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  acknowledged_at timestamptz
);

CREATE INDEX IF NOT EXISTS inventory_transfers_sender_idx
  ON public.inventory_transfers (sender_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_transfers_recipient_idx
  ON public.inventory_transfers (recipient_profile_id, status, created_at DESC);

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transfer participants can view history"
  ON public.inventory_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = inventory_transfers.sender_profile_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = inventory_transfers.recipient_profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Recipients may acknowledge transfers"
  ON public.inventory_transfers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = inventory_transfers.recipient_profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = inventory_transfers.recipient_profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER set_inventory_transfers_updated_at
  BEFORE UPDATE ON public.inventory_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to validate that two profiles are accepted friends
CREATE OR REPLACE FUNCTION public.profiles_are_friends(
  p_profile_a uuid,
  p_user_a uuid,
  p_profile_b uuid,
  p_user_b uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'::public.friendship_status
      AND (
        (f.user_id = p_user_a AND f.friend_user_id = p_user_b)
        OR (f.user_id = p_user_b AND f.friend_user_id = p_user_a)
        OR (
          f.user_profile_id IS NOT NULL
          AND f.friend_profile_id IS NOT NULL
          AND (
            (f.user_profile_id = p_profile_a AND f.friend_profile_id = p_profile_b)
            OR (f.user_profile_id = p_profile_b AND f.friend_profile_id = p_profile_a)
          )
        )
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.profiles_are_friends(uuid, uuid, uuid, uuid) TO authenticated;

-- RPC to transfer inventory items between friends
CREATE OR REPLACE FUNCTION public.transfer_inventory_items(
  p_sender_profile_id uuid,
  p_recipient_profile_id uuid,
  p_inventory_table text,
  p_item_ids uuid[]
) RETURNS TABLE (item_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_user_id uuid;
  v_recipient_user_id uuid;
  v_table_name text;
  v_has_updated_at boolean;
  v_update_sql text;
  v_row record;
  v_item_snapshot jsonb;
  v_updated boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to transfer inventory items.' USING ERRCODE = '28000';
  END IF;

  IF array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one inventory item to transfer.' USING ERRCODE = '22023';
  END IF;

  IF p_sender_profile_id = p_recipient_profile_id THEN
    RAISE EXCEPTION 'Cannot transfer inventory to the same profile.' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_sender_user_id
  FROM public.profiles
  WHERE id = p_sender_profile_id;

  IF v_sender_user_id IS NULL THEN
    RAISE EXCEPTION 'Sender profile % does not exist.', p_sender_profile_id USING ERRCODE = 'P0001';
  END IF;

  IF v_sender_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only transfer items owned by your profile.' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_recipient_user_id
  FROM public.profiles
  WHERE id = p_recipient_profile_id;

  IF v_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient profile % does not exist.', p_recipient_profile_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.profiles_are_friends(p_sender_profile_id, v_sender_user_id, p_recipient_profile_id, v_recipient_user_id) THEN
    RAISE EXCEPTION 'You can only trade with accepted friends.' USING ERRCODE = '42501';
  END IF;

  SELECT meta.table_name, meta.has_updated_at
  INTO v_table_name, v_has_updated_at
  FROM (VALUES
    ('player_skill_books', true)
  ) AS meta(table_name, has_updated_at)
  WHERE meta.table_name = p_inventory_table;

  IF v_table_name IS NULL THEN
    RAISE EXCEPTION 'Inventory table % is not supported for transfers.', p_inventory_table USING ERRCODE = '42809';
  END IF;

  v_update_sql := format(
    'UPDATE %I SET profile_id = $1%s WHERE id = ANY($2::uuid[]) AND profile_id = $3 RETURNING *',
    v_table_name,
    CASE WHEN v_has_updated_at THEN ', updated_at = timezone(''utc'', now())' ELSE '' END
  );

  BEGIN
    FOR v_row IN EXECUTE v_update_sql USING p_recipient_profile_id, p_item_ids, p_sender_profile_id
    LOOP
      v_updated := true;

      IF v_table_name = 'player_skill_books' THEN
        SELECT jsonb_build_object(
            'skill_book_id', v_row.skill_book_id,
            'title', sb.title,
            'skill_slug', sb.skill_slug,
            'xp_reward', sb.xp_reward
          )
        INTO v_item_snapshot
        FROM public.skill_books sb
        WHERE sb.id = v_row.skill_book_id;
      ELSE
        v_item_snapshot := NULL;
      END IF;

      INSERT INTO public.inventory_transfers (
        item_table,
        item_id,
        item_snapshot,
        sender_profile_id,
        sender_user_id,
        recipient_profile_id,
        recipient_user_id
      )
      VALUES (
        v_table_name,
        v_row.id,
        v_item_snapshot,
        p_sender_profile_id,
        v_sender_user_id,
        p_recipient_profile_id,
        v_recipient_user_id
      );

      RETURN NEXT v_row.id;
    END LOOP;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Your friend already owns one of the selected items.' USING ERRCODE = '23505';
  END;

  IF NOT v_updated THEN
    RAISE EXCEPTION 'No inventory entries matched the transfer request.' USING ERRCODE = 'P0002';
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_inventory_items(uuid, uuid, text, uuid[]) TO authenticated;

-- RPC to allow recipients to acknowledge transfers
CREATE OR REPLACE FUNCTION public.acknowledge_inventory_transfer(
  p_transfer_id uuid,
  p_recipient_profile_id uuid
) RETURNS public.inventory_transfers
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_transfer public.inventory_transfers%ROWTYPE;
  v_recipient_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to acknowledge transfers.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_transfer
  FROM public.inventory_transfers
  WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer % does not exist.', p_transfer_id USING ERRCODE = 'P0001';
  END IF;

  IF v_transfer.recipient_profile_id <> p_recipient_profile_id THEN
    RAISE EXCEPTION 'Transfer does not belong to the supplied profile.' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_recipient_user_id
  FROM public.profiles
  WHERE id = p_recipient_profile_id;

  IF v_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient profile % does not exist.', p_recipient_profile_id USING ERRCODE = 'P0001';
  END IF;

  IF v_recipient_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not allowed to acknowledge this transfer.' USING ERRCODE = '42501';
  END IF;

  IF v_transfer.status = 'acknowledged' THEN
    RETURN v_transfer;
  END IF;

  UPDATE public.inventory_transfers
  SET status = 'acknowledged',
      acknowledged_at = timezone('utc', now())
  WHERE id = p_transfer_id
  RETURNING * INTO v_transfer;

  RETURN v_transfer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_inventory_transfer(uuid, uuid) TO authenticated;

-- RPC to gift funds between player wallets with validation
CREATE OR REPLACE FUNCTION public.gift_wallet_funds(
  p_sender_profile_id uuid,
  p_recipient_profile_id uuid,
  p_amount integer
) RETURNS TABLE (
  sender_profile_id uuid,
  sender_balance integer,
  recipient_profile_id uuid,
  recipient_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_user_id uuid;
  v_recipient_user_id uuid;
  v_sender_balance integer;
  v_recipient_balance integer;
  v_updated_sender integer;
  v_updated_recipient integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to send gifts.' USING ERRCODE = '28000';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Gift amount must be greater than zero.' USING ERRCODE = '22023';
  END IF;

  IF p_sender_profile_id = p_recipient_profile_id THEN
    RAISE EXCEPTION 'Choose a different recipient profile.' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_sender_user_id
  FROM public.profiles
  WHERE id = p_sender_profile_id;

  IF v_sender_user_id IS NULL THEN
    RAISE EXCEPTION 'Sender profile % does not exist.', p_sender_profile_id USING ERRCODE = 'P0001';
  END IF;

  IF v_sender_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only send gifts from your own profile.' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_recipient_user_id
  FROM public.profiles
  WHERE id = p_recipient_profile_id;

  IF v_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'Recipient profile % does not exist.', p_recipient_profile_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.profiles_are_friends(p_sender_profile_id, v_sender_user_id, p_recipient_profile_id, v_recipient_user_id) THEN
    RAISE EXCEPTION 'You can only gift funds to accepted friends.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(xp_balance, 0)
  INTO v_sender_balance
  FROM public.player_xp_wallet
  WHERE profile_id = p_sender_profile_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet could not be found.' USING ERRCODE = 'P0001';
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'You do not have enough funds to complete this gift.' USING ERRCODE = '22003';
  END IF;

  SELECT COALESCE(xp_balance, 0)
  INTO v_recipient_balance
  FROM public.player_xp_wallet
  WHERE profile_id = p_recipient_profile_id
  FOR UPDATE;

  IF v_recipient_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient wallet could not be found.' USING ERRCODE = 'P0001';
  END IF;

  v_updated_sender := v_sender_balance - p_amount;
  v_updated_recipient := v_recipient_balance + p_amount;

  UPDATE public.player_xp_wallet
  SET xp_balance = v_updated_sender,
      xp_spent = COALESCE(xp_spent, 0) + p_amount
  WHERE profile_id = p_sender_profile_id;

  UPDATE public.player_xp_wallet
  SET xp_balance = v_updated_recipient
  WHERE profile_id = p_recipient_profile_id;

  RETURN QUERY
  SELECT p_sender_profile_id, v_updated_sender, p_recipient_profile_id, v_updated_recipient;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gift_wallet_funds(uuid, uuid, integer) TO authenticated;

COMMIT;
