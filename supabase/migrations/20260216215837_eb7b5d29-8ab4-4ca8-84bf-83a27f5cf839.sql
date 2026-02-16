
-- Allow admins to insert/update/delete pov_clip_templates
CREATE POLICY "Admins can insert pov_clip_templates"
ON public.pov_clip_templates
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pov_clip_templates"
ON public.pov_clip_templates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pov_clip_templates"
ON public.pov_clip_templates
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
