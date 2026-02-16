
-- Add cost columns to player_merchandise
ALTER TABLE public.player_merchandise ADD COLUMN IF NOT EXISTS storage_cost_daily numeric NOT NULL DEFAULT 0.10;
ALTER TABLE public.player_merchandise ADD COLUMN IF NOT EXISTS logistics_pct numeric NOT NULL DEFAULT 0.05;
ALTER TABLE public.player_merchandise ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 0.08;

-- Create merch_managers table
CREATE TABLE IF NOT EXISTS public.merch_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) NOT NULL,
  manager_name text NOT NULL,
  monthly_salary integer NOT NULL DEFAULT 2000,
  is_active boolean NOT NULL DEFAULT true,
  auto_restock_enabled boolean NOT NULL DEFAULT true,
  restock_threshold integer NOT NULL DEFAULT 10,
  restock_quantity integer NOT NULL DEFAULT 50,
  logistics_discount numeric NOT NULL DEFAULT 0.02,
  hired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(band_id)
);

ALTER TABLE public.merch_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their band merch managers"
  ON public.merch_managers FOR SELECT
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert merch managers for their bands"
  ON public.merch_managers FOR INSERT
  WITH CHECK (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their band merch managers"
  ON public.merch_managers FOR UPDATE
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their band merch managers"
  ON public.merch_managers FOR DELETE
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

-- Create merch-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('merch-images', 'merch-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view merch images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merch-images');

CREATE POLICY "Authenticated users can upload merch images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'merch-images' AND auth.role() = 'authenticated');

-- Insert merch-themed random events
INSERT INTO public.random_events (title, description, category, is_common, is_active, option_a_text, option_a_effects, option_a_outcome_text, option_b_text, option_b_effects, option_b_outcome_text) VALUES
('Bootleg Alert', 'Counterfeit versions of your best-selling merch are appearing at local markets. Your fans are confused.', 'merchandise', true, true, 'Sue the bootlegger', '{"cash": -500, "fame": 50}', 'You won the case! The bootleggers are shut down and your brand reputation is stronger.', 'Ignore it', '{"fame": -20}', 'The bootleg merch floods the market, undercutting your sales and confusing fans.'),
('Viral Merch Moment', 'A celebrity was spotted wearing your band tee in a viral social media post! Orders are flooding in.', 'merchandise', true, true, 'Capitalize with a flash sale', '{"cash": 800, "fame": 100}', 'The flash sale was a massive success — you moved hundreds of units in hours!', 'Play it cool', '{"fame": 60}', 'You let the moment speak for itself. The organic buzz builds your credibility.'),
('Factory Delay', 'Your merch manufacturer reports a supply chain disruption. Your next shipment is delayed.', 'merchandise', true, true, 'Pay rush fee', '{"cash": -1000}', 'The rush fee worked — your stock arrives on time and fans are happy.', 'Wait it out', '{"cash": 0}', 'You waited and lost 3 days of potential sales. Some fans bought from competitors.'),
('Fan Design Contest', 'Fans have been submitting incredible merch designs online. One design is going viral.', 'merchandise', true, true, 'Accept the winning design', '{"fame": 80, "cash": -200}', 'The fan-designed merch becomes your best seller! The community loves the collaboration.', 'Decline politely', '{"fame": -10}', 'Fans are a bit disappointed but understand. Business as usual.'),
('Warehouse Fire', 'A small fire broke out in the warehouse where your merch is stored. Some stock may be damaged.', 'merchandise', false, true, 'Pay insurance excess', '{"cash": -2000}', 'Insurance covers most of the loss. You recover 70% of the stock.', 'Accept the loss', '{"cash": -500}', 'You lose all stock of your most popular item. Time to rebuild.'),
('Celebrity Spotted in Your Merch', 'A major celebrity was photographed wearing your band hoodie at an airport!', 'merchandise', true, true, 'Post about it on social media', '{"fame": 150, "cash": 500}', 'The post goes viral! Your merch sales spike and new fans discover your music.', 'Stay quiet and let it happen', '{"fame": 40}', 'The moment passes organically. A quiet credibility boost.'),
('Tax Audit on Merch Sales', 'The tax authority is auditing your merchandise revenue. Your records need to be in order.', 'financial', false, true, 'Hire an accountant', '{"cash": -800}', 'The accountant sorts everything out. Clean bill of financial health.', 'Handle it yourself', '{"cash": -1500}', 'You made some mistakes on the forms and got hit with a penalty fine.'),
('Merch Manager Scandal', 'Your merchandise manager has been caught skimming profits from online sales!', 'merchandise', false, true, 'Fire and rehire a new manager', '{"cash": -500}', 'You swiftly dealt with the situation. The new manager is more trustworthy.', 'Cover it up', '{"fame": -100}', 'Word gets out anyway. Fans and media question your integrity.');
