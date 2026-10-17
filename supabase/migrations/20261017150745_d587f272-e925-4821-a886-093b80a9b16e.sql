CREATE POLICY "Signed-in players can read curated garments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'curated-garments');
CREATE POLICY "Admins upload curated garments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'curated-garments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update curated garments" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'curated-garments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete curated garments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'curated-garments' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_publish_uploaded_garment(p_item_id uuid, p_masculine_path text, p_feminine_path text, p_report jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF coalesce(p_masculine_path,'') = '' OR coalesce(p_feminine_path,'') = '' THEN RAISE EXCEPTION 'Both body frames are required'; END IF;
  UPDATE public.avatar_clothing_items
     SET render_config = (coalesce(render_config,'{}'::jsonb) - 'curatedSource')
           || jsonb_build_object('uploadedAssets', jsonb_build_object('masculine', p_masculine_path, 'feminine', p_feminine_path), 'uploadValidation', p_report),
         curated_asset_status = 'validated'
   WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_publish_uploaded_garment(uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_uploaded_garment(uuid,text,text,jsonb) TO authenticated;

-- Quick fixes for Cool Britannia items
UPDATE public.avatar_clothing_items
   SET material_config = coalesce(material_config,'{}'::jsonb) || '{"primaryColor":"#f4f2ec"}'::jsonb,
       render_config = coalesce(render_config,'{}'::jsonb) || '{"topRoundel":["#1f3c8f","#f4f2ec","#c8102e"]}'::jsonb,
       description = 'White terrace bucket hat with a red, white and blue mod target on the crown.'
 WHERE curated_asset_key = 'clothing.britpop.bucket-hat';
UPDATE public.avatar_clothing_items
   SET render_config = jsonb_set(render_config, '{curatedSource,style}', '"suit"')
 WHERE curated_asset_key = 'clothing.britpop.baggy-stonewash-jeans';