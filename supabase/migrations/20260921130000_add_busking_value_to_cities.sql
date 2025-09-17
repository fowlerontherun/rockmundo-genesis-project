-- Add busking value to cities to represent street performance favorability
alter table public.cities
  add column if not exists busking_value numeric not null default 1;

comment on column public.cities.busking_value is 'City-specific multiplier that influences busking outcomes.';

update public.cities
set busking_value = case name
  when 'Neo Tokyo' then 1.35
  when 'Solace City' then 1.22
  when 'Vela Horizonte' then 1.3
  when 'Asterhaven' then 1.18
  else 1
end;
