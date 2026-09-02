-- Allow label creators to seed their initial membership record

drop policy if exists label_members_insert_owner on public.label_members;

create policy label_members_insert_owner on public.label_members
for insert with check (
  (
    exists (
      select 1 from public.label_members lm
      where lm.label_id = label_members.label_id
        and lm.user_id = auth.uid()
        and lm.role in ('owner', 'manager')
    )
  )
  or (
    auth.uid() = (
      select labels.created_by from public.labels
      where labels.id = label_members.label_id
    )
    and label_members.user_id = auth.uid()
    and label_members.role = 'owner'
  )
);
