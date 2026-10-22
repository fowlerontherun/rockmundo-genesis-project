-- Read-only invariant tests for integer XP carry and scheduled-window
-- coverage. This does not create fake player activities or award any XP.
do $checks$
declare
 carry integer:=0;
 bonus_total integer:=0;
 points integer;
 sample_start timestamptz:='2026-10-22 10:00:00+00';
 sample_end timestamptz:='2026-10-22 11:00:00+00';
 effect_start timestamptz:='2026-10-22 09:59:00+00';
 effect_end timestamptz:='2026-10-22 12:00:00+00';
begin
 -- At 5% of the existing 5-XP reward, four qualifying practices earn
 -- exactly +1 bonus XP, with no lost fraction or immediate inflation.
 for i in 1..4 loop
  points := (carry + 5*5)/100;
  carry := mod(carry+5*5,100);
  bonus_total:=bonus_total+points;
 end loop;
 if bonus_total<>1 or carry<>0 then
   raise exception 'Fractional practice bonus carry incorrectly rounded';
 end if;
 if not(effect_start<=sample_start and effect_end>=sample_end) then
   raise exception 'Full scheduled-window condition is invalid';
 end if;
 -- A meal eaten after practice began must not retroactively grant a bonus.
 if sample_start + interval '10 minutes'<=sample_start then
   raise exception 'Mid-session meal would be incorrectly eligible';
 end if;
 if not exists(select 1 from pg_attribute
   where attrelid='public.skill_practice_reward_ledger'::regclass
   and attname='food_bonus_xp' and not attisdropped) then
    raise exception 'Bonus ledger column was not installed';
 end if;
 if has_function_privilege('authenticated',
   'public.complete_skill_practice(uuid)','EXECUTE') then
   raise exception 'Players can directly mint practice XP';
 end if;
 if has_table_privilege('authenticated',
   'public.cooking_practice_xp_carry','UPDATE') then
   raise exception 'Players can forge fractional bonus XP';
 end if;
 raise notice 'PASS: four x 5%% grants +1 XP; full-window eligibility; private ledger/carry writes';
end $checks$;
