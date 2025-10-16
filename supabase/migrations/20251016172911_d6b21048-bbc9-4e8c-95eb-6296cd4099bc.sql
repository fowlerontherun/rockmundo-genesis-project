-- Create trigger function to automatically create twaat metrics
CREATE OR REPLACE FUNCTION public.create_twaat_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically create metrics record for new twaat
  INSERT INTO public.twaat_metrics (twaat_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create metrics on twaat insert
DROP TRIGGER IF EXISTS create_twaat_metrics_trigger ON public.twaats;
CREATE TRIGGER create_twaat_metrics_trigger
  AFTER INSERT ON public.twaats
  FOR EACH ROW
  EXECUTE FUNCTION public.create_twaat_metrics();