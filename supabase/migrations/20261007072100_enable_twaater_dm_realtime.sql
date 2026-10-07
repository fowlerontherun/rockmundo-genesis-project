do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'twaater_messages'
  ) then
    alter publication supabase_realtime add table public.twaater_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'twaater_conversations'
  ) then
    alter publication supabase_realtime add table public.twaater_conversations;
  end if;
end
$$;
