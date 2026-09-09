-- Merch Studio now supports catalogue colours and hex colours rather than only
-- the original legacy white/black t-shirt choices. The old constraint blocks
-- valid saves such as #171717, Navy and Forest Green.

alter table public.tshirt_designs
  drop constraint if exists tshirt_designs_background_color_check;

alter table public.tshirt_designs
  add constraint tshirt_designs_background_color_check
  check (
    background_color is not null
    and length(btrim(background_color)) between 1 and 64
  );

comment on column public.tshirt_designs.background_color is
  'Garment/base colour selected in Merch Studio. Supports hex values and catalogue colour names.';
