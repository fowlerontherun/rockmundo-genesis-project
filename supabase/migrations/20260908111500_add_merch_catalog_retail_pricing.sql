alter table public.merch_item_requirements
  add column if not exists recommended_retail_price integer,
  add column if not exists minimum_retail_price integer;

update public.merch_item_requirements
set recommended_retail_price = case item_type
  when 'Basic Sticker Pack' then 5
  when 'Band Poster' then 10
  when 'Guitar Pick Pack' then 6
  when 'Holographic Sticker Pack' then 7
  when 'Keyring' then 8
  when 'Patch' then 8
  when 'Enamel Pin' then 10
  when 'Mug' then 12
  when 'Replica Setlist' then 12
  when 'Basic Tee' then 18
  when 'Lanyard + Laminate' then 12
  when 'Pint Glass' then 15
  when 'Tour Tote Bag' then 15
  when 'Graphic Tee' then 25
  when 'Tour Programme' then 18
  when 'Beanie' then 20
  when 'Signed Poster' then 30
  when 'Heavyweight Tee' then 30
  when 'Embroidered Cap' then 25
  when 'Tour Photo Zine' then 22
  when 'Long Sleeve Tee' then 30
  when 'Starter Fan Pack' then 30
  when 'Collectors Pin Set' then 35
  when 'Limited Art Print' then 40
  when 'Tour Crewneck' then 45
  when 'Football Shirt' then 55
  when 'Premium Hoodie' then 60
  when 'Numbered Vinyl Variant' then 50
  when 'Tour Essentials Bundle' then 60
  when 'Zip Hoodie' then 70
  when 'Deluxe Fan Bundle' then 100
  when 'Limited Edition Jacket' then 130
  when 'Ultimate VIP Bundle' then 250
  when 'Digital Wallpaper Pack' then 5
  when 'Lyric Book PDF' then 5
  when 'Exclusive Remix Pack' then 10
  when 'Behind-the-Scenes Video' then 15
  when 'Soundcheck Access' then 45
  when 'Meet & Greet' then 100
  when 'Private Listening Session' then 150
  when 'VIP Lounge Access' then 175
  else greatest(1, round(base_cost * 2.5)::integer)
end,
minimum_retail_price = case
  when product_kind = 'physical' then greatest(base_cost + 1, ceil(base_cost * 1.35)::integer)
  when product_kind = 'digital' then 1
  else greatest(base_cost, 1)
end;

alter table public.merch_item_requirements
  alter column recommended_retail_price set not null,
  alter column minimum_retail_price set not null;

alter table public.merch_item_requirements
  drop constraint if exists merch_item_requirements_recommended_retail_positive,
  add constraint merch_item_requirements_recommended_retail_positive check (recommended_retail_price > 0),
  drop constraint if exists merch_item_requirements_minimum_retail_positive,
  add constraint merch_item_requirements_minimum_retail_positive check (minimum_retail_price > 0),
  drop constraint if exists merch_item_requirements_retail_price_order,
  add constraint merch_item_requirements_retail_price_order check (recommended_retail_price >= minimum_retail_price);