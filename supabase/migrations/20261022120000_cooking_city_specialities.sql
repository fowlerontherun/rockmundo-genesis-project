-- A city-specific specialty rotation complements country-defined production.
-- Deterministic by city ID, not random on each page load; no cash/stock debit.
with city_goods as (
 select c.id as city_id,
  (array['mushrooms','rice','beans','orchard-fruit','citrus','peppers','tea','apples'])[1+(get_byte(decode(md5(c.id::text),'hex'),0)%8)] as first_slug,
  (array['spices','maize','tropical-fruit','lentils','rice-flour','basil','soy-seasoning','rice'])[1+(get_byte(decode(md5(c.id::text),'hex'),1)%8)] as second_slug
 from public.cities c
),
specialties as (
 select city_id,first_slug as slug from city_goods
 union
 select city_id,second_slug as slug from city_goods
)
insert into public.cooking_city_market_offers
 (city_id,ingredient_slug,unit_price,quality,stock,max_stock,is_active,local_speciality)
select x.city_id,x.slug,greatest(1,i.base_price),75,90,90,false,true
from specialties x join public.cooking_market_ingredients i on i.slug=x.slug
on conflict (city_id,ingredient_slug) do nothing;
