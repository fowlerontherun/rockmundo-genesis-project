-- Integration harness for a disposable development database with seeded
-- profiles/skills. It changes no persistent data: a nested subtransaction
-- deliberately rolls back every synthetic meal, schedule and reward.
-- Do NOT use with real player accounts outside a controlled test environment.
do $test$
declare
 chosen record;
 start_time timestamptz;
 activity_id uuid;
 batch_id uuid;
 result jsonb;
 replay jsonb;
 reward integer;
 expected_reward integer;
 stored_carry integer;
 activities uuid[] := '{}'::uuid[];
begin
 select sp.profile_id,sp.skill_slug,p.user_id into chosen
 from public.skill_progress sp
 join public.profiles p on p.id=sp.profile_id
 where sp.current_level>=1 and p.is_active=true
   and p.died_at is null and p.deleted_at is null
   and public.skill_tier_unlocked(sp.profile_id,sp.skill_slug::text)
 order by sp.profile_id,sp.skill_slug limit 1;
 if not found then
   raise notice 'SKIPPED: seed a profile with one unlocked skill';
   return;
 end if;
 begin
   perform set_config('request.jwt.claim.role','service_role',true);
   perform set_config('request.jwt.claims',
     jsonb_build_object('role','service_role')::text,true);
   if auth.role() <> 'service_role' then
     raise exception 'Test environment must emulate trusted settlement';
   end if;

   for i in 1..4 loop
     activity_id:=gen_random_uuid();
     batch_id:=gen_random_uuid();
     start_time:=clock_timestamp()-make_interval(days => 5-i)
       - interval '2 hours';
     insert into public.cooking_food_batches
       (id,profile_id,recipe_slug,portions,quality,prepared_at,expires_at)
     values(batch_id,chosen.profile_id,'bean-stew',0,100,
       start_time-interval '30 minutes',start_time+interval '10 hours');
     insert into public.cooking_food_consumptions
       (request_id,profile_id,food_batch_id,recipe_slug,quality,
         remaining_portions,effect_slug,effect_percent,effect_applied,
         effect_expires_at,consumed_at)
     values(gen_random_uuid(),chosen.profile_id,batch_id,'bean-stew',100,
       0,'practice_xp',5,true,start_time+interval '2 hours',
       start_time-interval '15 minutes');
     insert into public.player_scheduled_activities
       (id,user_id,profile_id,activity_type,scheduled_start,
        scheduled_end,status,title,metadata)
     values(activity_id,chosen.user_id,chosen.profile_id,'skill_practice',
       start_time,start_time+interval '1 hour','scheduled',
       'Rollback-only food bonus practice',
       jsonb_build_object('skillSlug',chosen.skill_slug));
     result:=public.complete_skill_practice(activity_id);
     expected_reward:=case when i=4 then 6 else 5 end;
     reward:=(result->>'xp_awarded')::integer;
     if reward is distinct from expected_reward then
       raise exception 'Session % got % XP; expected %',i,reward,expected_reward;
     end if;
     if (result->>'food_bonus_percent')::integer<>5 then
       raise exception 'Practice did not recognize time-covered food';
     end if;
     replay:=public.complete_skill_practice(activity_id);
     if replay->>'already_rewarded'<>'true'
       or (replay->>'xp_awarded')::integer<>expected_reward then
       raise exception 'Practice retry was not idempotent';
     end if;
     activities:=array_append(activities,activity_id);
   end loop;
   select xp_hundredths into stored_carry
     from public.cooking_practice_xp_carry
     where profile_id=chosen.profile_id;
   if stored_carry<>0 then
     raise exception 'Four practices should consume exact fractional carry';
   end if;
   if (select count(*) from public.skill_practice_reward_ledger
       where activity_id=any(activities))<>4 then
     raise exception 'Practice award ledger has duplicate or missing rewards';
   end if;
   raise exception using errcode='PZ001',message='ROLLBACK_COOKING_PRACTICE_FIXTURE';
 exception when sqlstate 'PZ001' then
   raise notice 'PASS: 4 sessions +1 food XP, historical eligibility, stable retries, ledger; rolled back';
 end;
end $test$;
