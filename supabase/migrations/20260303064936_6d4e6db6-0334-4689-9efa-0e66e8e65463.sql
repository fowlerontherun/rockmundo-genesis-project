-- Widen skill_level and performance_rating on label_staff to allow larger values
ALTER TABLE public.label_staff 
  ALTER COLUMN skill_level TYPE numeric(5,2),
  ALTER COLUMN performance_rating TYPE numeric(5,2);