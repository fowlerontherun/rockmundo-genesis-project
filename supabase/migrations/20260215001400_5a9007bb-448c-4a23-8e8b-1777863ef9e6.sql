
-- Create lottery_draws table
CREATE TABLE public.lottery_draws (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL UNIQUE,
  draw_date timestamptz,
  winning_numbers int[],
  bonus_number int,
  jackpot_amount int NOT NULL DEFAULT 1000000,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'drawn', 'paid_out')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create lottery_tickets table
CREATE TABLE public.lottery_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id),
  selected_numbers int[] NOT NULL,
  bonus_number int NOT NULL,
  matches int,
  bonus_matched boolean NOT NULL DEFAULT false,
  prize_cash int NOT NULL DEFAULT 0,
  prize_xp int NOT NULL DEFAULT 0,
  prize_fame int NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, draw_id)
);

-- Enable RLS
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;

-- Lottery draws: all authenticated users can view
CREATE POLICY "Anyone can view lottery draws"
  ON public.lottery_draws FOR SELECT
  TO authenticated
  USING (true);

-- Lottery tickets: players can view their own
CREATE POLICY "Players can view own tickets"
  ON public.lottery_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Lottery tickets: players can insert their own
CREATE POLICY "Players can buy tickets"
  ON public.lottery_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  );

-- Index for faster ticket lookups
CREATE INDEX idx_lottery_tickets_user_draw ON public.lottery_tickets(user_id, draw_id);
CREATE INDEX idx_lottery_tickets_draw ON public.lottery_tickets(draw_id);
CREATE INDEX idx_lottery_draws_status ON public.lottery_draws(status);
