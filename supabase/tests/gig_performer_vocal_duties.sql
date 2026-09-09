-- Run in a test database. Every membership/lineup fixture change is rolled back.
begin;
do $$
declare candidate record; gig_id uuid; owner_id uuid; rejected boolean := false; seeded integer;
begin
  for candidate in select * from (values
    ('Bass Guitar','Backup Singer','Bass Guitar / Backup Singer'),
    ('Acoustic Guitar','Lead Vocals','Acoustic Guitar / Lead Vocals'),
    ('Drums','None','Drums'), ('Vocals','Lead Singer','Vocals'),
    (null,'Lead Singer','Lead Singer'), ('  ','  ',null), ('Piano',null,'Piano')
  ) as cases(instrument,vocal,expected) loop
    if public.stage_performer_duties(candidate.instrument,candidate.vocal) is distinct from candidate.expected then
      raise exception 'Vocal duty snapshot mismatch';
    end if;
  end loop;
  if has_function_privilege('anon','public.seed_gig_performers(uuid)','execute') then raise exception 'Anonymous lineup writer exposed'; end if;
  if has_function_privilege('authenticated','public.seed_gig_performers_on_insert()','execute') then raise exception 'Trigger exposed as RPC'; end if;
  select g.id,p.user_id into gig_id,owner_id
  from public.gigs g join public.band_members bm on bm.band_id=g.band_id join public.profiles p on p.id=bm.profile_id
  where coalesce(bm.member_status,'active')='active' and p.user_id is not null and coalesce(g.status,'') not in ('cancelled','failed') limit 1;
  if gig_id is null then raise exception 'A band/gig fixture is required'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  begin perform public.seed_gig_performers(gig_id); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Cross-band lineup call accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  seeded:=public.seed_gig_performers(gig_id);
  if seeded < 0 then raise exception 'Band member lineup preparation failed'; end if;
end $$;
rollback;
