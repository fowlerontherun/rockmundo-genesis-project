-- Add admin DELETE, INSERT, and UPDATE policies for universities
CREATE POLICY "Admins can delete universities"
  ON public.universities FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert universities"
  ON public.universities FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update universities"
  ON public.universities FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies for university_courses
CREATE POLICY "Admins can delete courses"
  ON public.university_courses FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert courses"
  ON public.university_courses FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update courses"
  ON public.university_courses FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));