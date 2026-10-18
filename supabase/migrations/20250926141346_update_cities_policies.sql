-- Tighten city management policies to admin-only while allowing service role access
alter table public.cities enable row level security;

drop policy if exists "Authenticated users manage cities" on public.cities;

create policy "Admin manage cities"
  on public.cities
  for all
  using (
    auth.role() = 'service_role'
    or (
      auth.role() = 'authenticated'
      and public.has_role(auth.uid(), 'admin')
    )
  )
  with check (
    auth.role() = 'service_role'
    or (
      auth.role() = 'authenticated'
      and public.has_role(auth.uid(), 'admin')
    )
  );
