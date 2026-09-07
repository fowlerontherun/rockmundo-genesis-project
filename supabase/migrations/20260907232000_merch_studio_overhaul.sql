-- Merchandise Studio overhaul: unify the product catalogue, remove artificial locks from
-- normal merchandise, add POD-style product metadata and support reusable artwork.

alter table public.merch_item_requirements
  add column if not exists product_kind text not null default 'physical',
  add column if not exists base_material text,
  add column if not exists supplier_tier text not null default 'standard',
  add column if not exists min_order_qty integer not null default 1,
  add column if not exists lead_time_days integer not null default 2,
  add column if not exists is_personalisable boolean not null default true,
  add column if not exists print_areas jsonb not null default '["front"]'::jsonb,
  add column if not exists colour_options jsonb not null default '[]'::jsonb,
  add column if not exists catalog_source text not null default 'rockmundo',
  add column if not exists catalog_source_ref text;

alter table public.player_merchandise
  add column if not exists product_requirement_id uuid references public.merch_item_requirements(id) on delete set null,
  add column if not exists design_data jsonb,
  add column if not exists artwork_url text,
  add column if not exists garment_color text,
  add column if not exists supplier_tier text not null default 'standard',
  add column if not exists lead_time_days integer not null default 0,
  add column if not exists production_status text not null default 'ready';

alter table public.tshirt_designs
  add column if not exists product_type text not null default 'Graphic Tee',
  add column if not exists artwork_url text,
  add column if not exists preview_data_url text;

update public.merch_item_requirements
set min_fame = 0, min_fans = 0, min_level = 1
where category in ('Apparel','Accessories','Collectibles','Digital','Bundles');

update public.merch_item_requirements
set product_kind = case
      when category = 'Experiences' then 'experience'
      when category = 'Digital' then 'digital'
      else 'physical'
    end,
    is_personalisable = category not in ('Experiences','Digital'),
    min_order_qty = case when category in ('Experiences','Digital') then 1 else 10 end,
    lead_time_days = case when category in ('Experiences','Digital') then 0 else 3 end;

update public.merch_item_requirements set base_material='180gsm cotton', supplier_tier='standard', print_areas='["front","back"]'::jsonb, colour_options='["Black","White","Navy","Red","Forest Green","Royal Blue"]'::jsonb, min_order_qty=10, lead_time_days=3, catalog_source='pod_reference' where item_type in ('Basic Tee','Graphic Tee');
update public.merch_item_requirements set base_material='320gsm brushed cotton', supplier_tier='premium', print_areas='["front","back","sleeve"]'::jsonb, colour_options='["Black","Heather Grey","Navy","Burgundy"]'::jsonb, min_order_qty=10, lead_time_days=4, catalog_source='pod_reference' where item_type='Premium Hoodie';
update public.merch_item_requirements set base_material='280gsm cotton blend', supplier_tier='premium', print_areas='["front","back"]'::jsonb, colour_options='["Black","Heather Grey","Navy","Cream"]'::jsonb, min_order_qty=10, lead_time_days=4, catalog_source='pod_reference' where item_type='Tour Crewneck';
update public.merch_item_requirements set base_material='cotton twill', supplier_tier='standard', print_areas='["front"]'::jsonb, colour_options='["Black","Navy","Stone","Red"]'::jsonb, min_order_qty=10, lead_time_days=4, catalog_source='pod_reference' where item_type='Embroidered Cap';
update public.merch_item_requirements set base_material='heavy canvas', supplier_tier='standard', print_areas='["front","back"]'::jsonb, colour_options='["Natural","Black"]'::jsonb, min_order_qty=10, lead_time_days=3, catalog_source='pod_reference' where item_type='Tour Tote Bag';
update public.merch_item_requirements set base_material='170gsm silk paper', supplier_tier='standard', print_areas='["front"]'::jsonb, colour_options='[]'::jsonb, min_order_qty=10, lead_time_days=2, catalog_source='pod_reference' where item_type in ('Band Poster','Signed Poster','Limited Art Print');

insert into public.merch_item_requirements
(item_type,category,min_fame,min_fans,min_level,base_quality_tier,base_cost,description,product_kind,base_material,supplier_tier,min_order_qty,lead_time_days,is_personalisable,print_areas,colour_options,catalog_source)
values
('Heavyweight Tee','Apparel',0,0,1,'standard',9,'Premium heavyweight band t-shirt','physical','220gsm ringspun cotton','premium',10,4,true,'["front","back"]','["Black","White","Washed Black","Cream","Navy"]','pod_reference'),
('Long Sleeve Tee','Apparel',0,0,1,'standard',11,'Long-sleeve cotton band shirt','physical','200gsm cotton','standard',10,4,true,'["front","back","sleeve"]','["Black","White","Navy","Forest Green"]','pod_reference'),
('Zip Hoodie','Apparel',0,0,1,'premium',29,'Heavy zip hoodie with multiple print areas','physical','330gsm brushed cotton','premium',10,5,true,'["front","back","sleeve"]','["Black","Heather Grey","Navy"]','pod_reference'),
('Beanie','Apparel',0,0,1,'standard',8,'Embroidered cuff beanie','physical','rib-knit acrylic','standard',10,4,true,'["front"]','["Black","Grey","Navy","Burgundy"]','pod_reference'),
('Football Shirt','Apparel',0,0,1,'premium',22,'Custom performance football-style shirt','physical','recycled performance polyester','premium',10,6,true,'["front","back","sleeve"]','["Black","White","Red","Blue"]','pod_reference'),
('Mug','Accessories',0,0,1,'basic',4,'11oz printed ceramic mug','physical','ceramic','standard',12,3,true,'["wrap"]','["White","Black"]','pod_reference'),
('Pint Glass','Accessories',0,0,1,'standard',6,'Printed pint glass','physical','glass','standard',12,4,true,'["front"]','[]','pod_reference'),
('Patch','Accessories',0,0,1,'basic',3,'Woven or embroidered band patch','physical','woven textile','standard',25,4,true,'["front"]','[]','pod_reference'),
('Keyring','Accessories',0,0,1,'basic',3,'Custom band keyring','physical','metal/acrylic','standard',25,4,true,'["front","back"]','[]','pod_reference'),
('Guitar Pick Pack','Collectibles',0,0,1,'basic',2,'Set of branded guitar picks','physical','celluloid','standard',25,3,true,'["front","back"]','[]','pod_reference'),
('Replica Setlist','Collectibles',0,0,1,'standard',4,'Printed replica setlist from a show','physical','heavy card','standard',10,2,true,'["front"]','[]','pod_reference'),
('Tour Programme','Collectibles',0,0,1,'standard',7,'Multi-page tour programme','physical','premium paper','standard',25,5,true,'["front","back"]','[]','pod_reference')
on conflict (item_type) do update set
 category=excluded.category,
 min_fame=excluded.min_fame,
 min_fans=excluded.min_fans,
 min_level=excluded.min_level,
 base_quality_tier=excluded.base_quality_tier,
 base_cost=excluded.base_cost,
 description=excluded.description,
 product_kind=excluded.product_kind,
 base_material=excluded.base_material,
 supplier_tier=excluded.supplier_tier,
 min_order_qty=excluded.min_order_qty,
 lead_time_days=excluded.lead_time_days,
 is_personalisable=excluded.is_personalisable,
 print_areas=excluded.print_areas,
 colour_options=excluded.colour_options,
 catalog_source=excluded.catalog_source;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('merch-artwork','merch-artwork',true,10485760,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set
  public=true,
  file_size_limit=10485760,
  allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists "Band members can upload merch artwork" on storage.objects;
create policy "Band members can upload merch artwork"
on storage.objects for insert to authenticated
with check (bucket_id='merch-artwork' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "Owners can update merch artwork" on storage.objects;
create policy "Owners can update merch artwork"
on storage.objects for update to authenticated
using (bucket_id='merch-artwork' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='merch-artwork' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "Owners can delete merch artwork" on storage.objects;
create policy "Owners can delete merch artwork"
on storage.objects for delete to authenticated
using (bucket_id='merch-artwork' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Keep inventory rows tied to the canonical catalogue even when older UI code only sends item_type.
create or replace function public.sync_merchandise_catalog_metadata()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  requirement public.merch_item_requirements%rowtype;
begin
  select * into requirement
  from public.merch_item_requirements
  where item_type = new.item_type
  limit 1;

  if found then
    new.product_requirement_id := requirement.id;
    new.supplier_tier := coalesce(requirement.supplier_tier, 'standard');
    new.lead_time_days := coalesce(requirement.lead_time_days, 0);
    if new.quality_tier is null then
      new.quality_tier := requirement.base_quality_tier;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_merchandise_catalog_metadata on public.player_merchandise;
create trigger trg_sync_merchandise_catalog_metadata
before insert or update of item_type on public.player_merchandise
for each row execute function public.sync_merchandise_catalog_metadata();

update public.player_merchandise pm
set product_requirement_id = mir.id,
    supplier_tier = coalesce(mir.supplier_tier, 'standard'),
    lead_time_days = coalesce(mir.lead_time_days, 0)
from public.merch_item_requirements mir
where pm.item_type = mir.item_type;
