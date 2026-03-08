
CREATE TABLE public.casino_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('blackjack', 'roulette', 'slots')),
  bet_amount NUMERIC NOT NULL CHECK (bet_amount > 0),
  payout NUMERIC NOT NULL DEFAULT 0,
  net_result NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.casino_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own casino transactions"
  ON public.casino_transactions
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own casino transactions"
  ON public.casino_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE INDEX idx_casino_transactions_profile ON public.casino_transactions(profile_id);
CREATE INDEX idx_casino_transactions_created ON public.casino_transactions(created_at);
