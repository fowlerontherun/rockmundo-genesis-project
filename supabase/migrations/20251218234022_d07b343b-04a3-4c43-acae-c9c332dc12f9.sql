-- Create player_loans table for tracking active loans
CREATE TABLE public.player_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_name TEXT NOT NULL,
  principal INTEGER NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  remaining_balance INTEGER NOT NULL,
  weekly_payment INTEGER NOT NULL,
  total_paid INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create player_investments table for tracking investments
CREATE TABLE public.player_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Equity', 'Real Assets', 'Cash', 'Royalties', 'Startups')),
  invested_amount INTEGER NOT NULL,
  current_value INTEGER NOT NULL,
  growth_rate DECIMAL(5,4) DEFAULT 0.0001, -- Daily growth rate
  purchased_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.player_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_investments ENABLE ROW LEVEL SECURITY;

-- RLS policies for player_loans
CREATE POLICY "Users can view their own loans" 
ON public.player_loans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loans" 
ON public.player_loans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loans" 
ON public.player_loans 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS policies for player_investments
CREATE POLICY "Users can view their own investments" 
ON public.player_investments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own investments" 
ON public.player_investments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investments" 
ON public.player_investments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own investments" 
ON public.player_investments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX idx_player_loans_user_id ON public.player_loans(user_id);
CREATE INDEX idx_player_loans_status ON public.player_loans(status);
CREATE INDEX idx_player_investments_user_id ON public.player_investments(user_id);
CREATE INDEX idx_player_investments_category ON public.player_investments(category);

-- Create trigger for updating timestamps
CREATE TRIGGER update_player_loans_updated_at
BEFORE UPDATE ON public.player_loans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_investments_updated_at
BEFORE UPDATE ON public.player_investments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();