do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.twaater_accounts'::regclass
      and conname = 'twaater_accounts_handle_format_check'
  ) then
    alter table public.twaater_accounts
      add constraint twaater_accounts_handle_format_check
      check (handle ~ '^[A-Za-z0-9_]+$');
  end if;
end
$$;
