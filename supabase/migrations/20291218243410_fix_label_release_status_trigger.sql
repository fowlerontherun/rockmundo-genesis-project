-- Finalise the consolidated label release trigger without referencing OLD on INSERT.
create or replace function public.handle_release_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  label_identifier uuid;
  reputation_delta integer;
begin
  if tg_op = 'INSERT' then
    if new.status = 'released' then
      update public.artist_label_contracts
      set releases_completed = releases_completed + 1,
          updated_at = now()
      where id = new.contract_id;
    end if;
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'released' then
    update public.artist_label_contracts
    set releases_completed = releases_completed + 1,
        updated_at = now()
    where id = new.contract_id;

    select label_id
    into label_identifier
    from public.artist_label_contracts
    where id = new.contract_id;

    reputation_delta := least(
      50,
      greatest(
        -20,
        (new.sales_units / 1000)
          + coalesce((new.gross_revenue / 1000)::integer, 0)
      )
    );

    insert into public.label_reputation_events(label_id, release_id, delta, reason)
    values(label_identifier, new.id, reputation_delta, 'Release performance');
  end if;

  return new;
end;
$$;
