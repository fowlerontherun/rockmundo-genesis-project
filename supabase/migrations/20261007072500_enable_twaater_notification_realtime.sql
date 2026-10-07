do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'twaater_notifications'
  ) then
    alter publication supabase_realtime add table public.twaater_notifications;
  end if;
end
$$;
