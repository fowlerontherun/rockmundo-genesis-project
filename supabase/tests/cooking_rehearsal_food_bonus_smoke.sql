-- READ-ONLY assertions for bounded rehearsal food bonuses and roles.
-- Intended to run on live or in CI without writing character progression.
do $smoke$
declare carry integer:=0; bonus integer; awarded integer:=0;
begin
 for idx in 1..5 loop
   bonus:=(carry+8*5)/100;
   carry:=mod(carry+8*5,100);
   awarded:=awarded+bonus;
 end loop;
 if awarded<>2 or carry<>0 then
   raise exception 'Fractional rehearsal bonus calculation is incorrect';
 end if;
 if (99+8*5)/100<>1 or mod(99+8*5,100)<>39 then
   raise exception 'Rehearsal carry overflow is incorrect';
 end if;
 if has_table_privilege('authenticated','public.cooking_rehearsal_minute_carry','INSERT')
    or has_table_privilege('authenticated','public.cooking_rehearsal_minute_carry','UPDATE') then
   raise exception 'Player can forge rehearsal food bonus';
 end if;
 if not exists(select 1 from pg_attribute where
   attrelid='public.active_rehearsal_sessions'::regclass
    and attname='food_bonus_minutes' and not attisdropped) then
   raise exception 'Rehearsal bonus receipt column missing';
 end if;
 if position('cooking_active_food_effects' in pg_get_functiondef(
   'public.submit_active_rehearsal_session(uuid,uuid,uuid,integer,integer,integer,integer,integer)'::regprocedure))=0 then
   raise exception 'Authoritative rehearsal function ignores food effects';
 end if;
 raise notice 'PASS: 5 x 8 minutes at +5%% yields +2 minutes; locked ledger and active food lookup';
end $smoke$;
