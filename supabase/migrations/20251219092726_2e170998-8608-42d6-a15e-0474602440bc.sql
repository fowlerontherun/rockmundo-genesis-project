-- Add missing columns to sponsorship_payments for tracking status
ALTER TABLE sponsorship_payments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid', 'cancelled')),
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Update existing payments to have status
UPDATE sponsorship_payments SET status = 'paid' WHERE status IS NULL;

-- Add cron job config for sponsorship payments
INSERT INTO public.cron_job_config (job_name, edge_function_name, display_name, description, schedule, allow_manual_trigger)
VALUES ('process_sponsorship_payments', 'process-sponsorship-payments', 'Process Sponsorship Payments', 'Processes weekly sponsorship payments to bands and players', '0 0 * * 0', true)
ON CONFLICT (job_name) DO NOTHING;