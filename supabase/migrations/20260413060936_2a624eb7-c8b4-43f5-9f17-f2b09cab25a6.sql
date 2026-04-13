
-- Add weekly member pay column to bands table
ALTER TABLE public.bands 
ADD COLUMN IF NOT EXISTS weekly_member_pay INTEGER NOT NULL DEFAULT 0;

-- Add a comment for clarity
COMMENT ON COLUMN public.bands.weekly_member_pay IS 'Amount in dollars each real player member gets paid every Monday at 9am';
