
CREATE TABLE IF NOT EXISTS public.company_job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vacancy_id UUID NOT NULL REFERENCES public.company_vacancies(id) ON DELETE CASCADE,
  applicant_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  suitability_score INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  offer_expires_at TIMESTAMPTZ,
  employment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_job_applications TO authenticated;
GRANT ALL ON public.company_job_applications TO service_role;
ALTER TABLE public.company_job_applications ENABLE ROW LEVEL SECURITY;
-- Application mutations require the verified recruitment RPC, not direct DML.
CREATE POLICY "Company owners view applications" ON public.company_job_applications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.company_vacancies v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = company_job_applications.vacancy_id AND c.owner_id = auth.uid()
  ));
-- The owner review RPC provides validated application decisions.
CREATE INDEX IF NOT EXISTS idx_company_job_applications_vacancy ON public.company_job_applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_company_job_applications_applicant ON public.company_job_applications(applicant_profile_id);
CREATE TRIGGER trg_company_job_applications_updated_at BEFORE UPDATE ON public.company_job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
