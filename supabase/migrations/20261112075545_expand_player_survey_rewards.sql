-- Keep the existing survey history and open the expanded questionnaire as a new round.
insert into public.player_survey_questions (category, question_text, question_type, options, display_order)
select category, question_text, question_type, options::jsonb, display_order
from (values
  ('player_context', 'How long have you been playing RockMundo?', 'multiple_choice', '["Less than a week","1 to 4 weeks","1 to 3 months","More than 3 months"]', 101),
  ('player_context', 'How do you usually play RockMundo?', 'multiple_choice', '["Desktop or laptop browser","Phone or tablet browser","Mobile companion","A mix of desktop and mobile"]', 102),
  ('priorities', 'Which area should we improve first?', 'multiple_choice', '["Getting started","Gigs, touring and festivals","Songwriting, recording and releases","Skills and progression","Economy and business","Bands and community","Navigation and accessibility","Mobile companion","Speed and reliability","Other"]', 103),
  ('priorities', 'What one change would make you more likely to keep playing?', 'free_text', null, 104),
  ('onboarding', 'What was hardest to work out when you started playing?', 'multiple_choice', '["What to do first","Joining or starting a band","Writing a first song","Booking a first gig","Earning or spending XP","Making money","Nothing was difficult"]', 105),
  ('onboarding', 'How clear was the next step after creating your first character? (1 = very unclear, 5 = very clear)', 'rating_1_5', null, 106),
  ('live_events', 'Which part of live events needs the most improvement?', 'multiple_choice', '["Gig booking","Tour routing and travel","Finding support bands","Festival applications and line-ups","Watching gigs and festivals","Understanding gig results","None of these"]', 107),
  ('live_events', 'How clear is the feedback on why a gig went well or badly? (1 = very unclear, 5 = very clear)', 'rating_1_5', null, 108),
  ('live_events', 'How easy is it to tell what is happening live at a festival? (1 = very difficult, 5 = very easy)', 'rating_1_5', null, 109),
  ('mobile', 'Which activity is hardest to do on your phone?', 'multiple_choice', '["Checking the schedule","Booking activities","Reading messages or chat","Managing XP or attribute points","Switching characters","Finding my way around","None of these"]', 110),
  ('mobile', 'How reliable is the mobile companion during a typical session? (1 = very unreliable, 5 = very reliable)', 'rating_1_5', null, 111),
  ('accessibility', 'Which change would make RockMundo easier for you to use?', 'multiple_choice', '["Larger text","Better colour contrast","Less motion","Better keyboard navigation","Better screen reader support","Clearer labels","None of these"]', 112),
  ('releases', 'Where do you most often get stuck when putting out music?', 'multiple_choice', '["Finishing songs","Booking or finishing recording","Mastering","Scheduling a release","Promotion","Understanding sales or charts","I do not usually get stuck"]', 113),
  ('releases', 'How easy is it to tell what helped a release sell? (1 = very difficult, 5 = very easy)', 'rating_1_5', null, 114),
  ('bands', 'What is the biggest barrier to playing with other people?', 'multiple_choice', '["Finding active players","Finding a band with similar goals","Coordinating schedules","Invitations are hard to find","I prefer to play solo","I have not had a problem"]', 115),
  ('bands', 'How easy is it to find bands to gig or tour with? (1 = very difficult, 5 = very easy)', 'rating_1_5', null, 116),
  ('progression', 'Which part of character progression is hardest to understand?', 'multiple_choice', '["Earning XP","Spending attribute points","Unlocking skills","Choosing books or courses","Understanding skill effects","None of these"]', 117),
  ('economy', 'Which income or cost is hardest to plan around?', 'multiple_choice', '["Ticket income","Music sales and streaming","Merchandise","Recording costs","Travel costs","Band cash versus personal cash","None of these"]', 118),
  ('performance', 'In the last seven days, what most often interrupted your play?', 'multiple_choice', '["Slow loading","An error stopped an action","Unexpected reloads or sign-outs","A scheduled activity did not complete","The gig viewer lagged","Nothing interrupted me"]', 119),
  ('city_life', 'What would give you more reason to spend time in a city?', 'multiple_choice', '["Local gigs or open mics","Community challenges","Local charts and news","Markets and crafting","More ways to meet players","Local bands or labels","Something else"]', 120)
) as added(category, question_text, question_type, options, display_order)
where not exists (
  select 1 from public.player_survey_questions existing
  where existing.question_text = added.question_text
);

insert into public.reward_config (reward_key, xp_amount, ap_amount)
values ('player_survey_completion', 1000, 50)
on conflict (reward_key) do nothing;

-- The same account sees the same set for a round. Core questions give comparable
-- answers across players, and the remaining slots rotate across distinct areas first.
create or replace function public.get_player_survey_questions(p_round text)
returns setof public.player_survey_questions
language sql
stable
security invoker
set search_path = ''
as $$
  with config as (
    select case jsonb_typeof(config_value::jsonb)
      when 'string' then (config_value::jsonb #>> '{}')::jsonb
      else config_value::jsonb
    end as value
    from public.game_config
    where config_key = 'player_survey_enabled'
  ),
  ranked as (
    select q as question,
      q.category in ('player_context', 'priorities') as core,
      row_number() over (
        partition by q.category
        order by md5(auth.uid()::text || ':' || p_round || ':' || q.id::text)
      ) as category_rank,
      md5(auth.uid()::text || ':' || p_round || ':' || q.id::text) as position
    from public.player_survey_questions q
    where q.is_active and auth.uid() is not null
  )
  select (ranked.question).*
  from ranked
  where exists (
    select 1 from config
    where value->>'enabled' = 'true' and coalesce(value->>'round', '2026-03') = p_round
  )
  order by core desc,
    case when core then (ranked.question).display_order end,
    category_rank, position, (ranked.question).id
  limit (select greatest(1, least(50, coalesce(nullif((value->>'questions_per_session')::integer, 0), 10))) from config)
$$;

revoke execute on function public.get_player_survey_questions(text) from public, anon;
grant execute on function public.get_player_survey_questions(text) to authenticated;

create schema if not exists player_survey_private;

create or replace function player_survey_private.submit_player_survey(p_round text, p_profile_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_completion_id uuid;
  v_questions public.player_survey_questions[];
  v_question public.player_survey_questions;
  v_answer jsonb;
  v_value text;
  v_numeric integer;
  v_reward public.reward_grants%rowtype;
  v_reward_key text;
begin
  if v_user_id is null then
    raise exception 'Sign in to complete the survey.';
  end if;

  if exists (
    select 1 from public.player_survey_completions
    where user_id = v_user_id and survey_round = p_round
  ) then
    return jsonb_build_object('already_completed', true);
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Invalid survey answers.';
  end if;

  select array_agg(q) into v_questions from public.get_player_survey_questions(p_round) q;
  if v_questions is null then
    raise exception 'This survey round is closed. Reload the page to see the current survey.';
  end if;

  if (select count(*) from jsonb_object_keys(p_answers)) <> cardinality(v_questions) then
    raise exception 'Answer each question before submitting.';
  end if;

  insert into public.player_survey_completions (user_id, profile_id, survey_round)
  values (v_user_id, p_profile_id, p_round)
  on conflict (user_id, survey_round) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    return jsonb_build_object('already_completed', true);
  end if;

  foreach v_question in array v_questions loop
    v_answer := p_answers->v_question.id::text;
    v_value := btrim(v_answer #>> '{}');
    v_numeric := null;

    if v_answer = 'null'::jsonb and (v_question.category not in ('player_context', 'priorities') or v_question.question_type = 'free_text') then
      v_value := null;
    elsif jsonb_typeof(v_answer) is distinct from 'string' or v_value = '' or char_length(v_value) > 2000 then
      raise exception 'Answer each question before submitting.';
    elsif v_question.question_type = 'rating_1_5' then
      if v_value not in ('1', '2', '3', '4', '5') then
        raise exception 'Select a rating between 1 and 5.';
      end if;
      v_numeric := v_value::integer;
    elsif (v_question.question_type = 'yes_no' and v_value not in ('Yes', 'No'))
      or (v_question.question_type = 'multiple_choice' and not coalesce(v_question.options ? v_value, false)) then
      raise exception 'Select one of the listed answers.';
    end if;

    insert into public.player_survey_responses (user_id, profile_id, question_id, survey_round, answer_value, answer_numeric)
    values (v_user_id, p_profile_id, v_question.id, p_round, v_value, v_numeric)
    on conflict (user_id, question_id, survey_round) do update
    set profile_id = excluded.profile_id, answer_value = excluded.answer_value, answer_numeric = excluded.answer_numeric;
  end loop;

  v_reward_key := 'player-survey:' || v_completion_id::text;
  perform public._apply_game_reward(
    v_user_id, p_profile_id, 'player_survey_completion', v_reward_key,
    null, jsonb_build_object('survey_round', p_round)
  );

  select * into strict v_reward from public.reward_grants where idempotency_key = v_reward_key;
  update public.player_survey_completions
  set xp_awarded = v_reward.xp_amount, attribute_points_awarded = v_reward.ap_amount
  where id = v_completion_id;

  return jsonb_build_object('already_completed', false, 'xp', v_reward.xp_amount, 'ap', v_reward.ap_amount);
end;
$$;

revoke all on function player_survey_private.submit_player_survey(text, uuid, jsonb) from public, anon, authenticated;
grant usage on schema player_survey_private to authenticated;
grant execute on function player_survey_private.submit_player_survey(text, uuid, jsonb) to authenticated;

create or replace function public.submit_player_survey(p_round text, p_profile_id uuid, p_answers jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select player_survey_private.submit_player_survey(p_round, p_profile_id, p_answers)
$$;

revoke execute on function public.submit_player_survey(text, uuid, jsonb) from public, anon;
grant execute on function public.submit_player_survey(text, uuid, jsonb) to authenticated;

-- Only a validated server submission can create answers and a reward receipt.
drop policy if exists "Players can insert own survey responses" on public.player_survey_responses;
drop policy if exists "Players can insert own survey completions" on public.player_survey_completions;
revoke insert, update, delete on public.player_survey_responses, public.player_survey_completions from anon, authenticated;

with current_config as (
  select case jsonb_typeof(config_value::jsonb)
    when 'string' then (config_value::jsonb #>> '{}')::jsonb
    else config_value::jsonb
  end as value
  from public.game_config
  where config_key = 'player_survey_enabled'
)
update public.game_config config
set config_value = current_config.value || '{"round":"2026-11 Game Review","questions_per_session":14}'::jsonb,
    updated_at = now()
from current_config
where config.config_key = 'player_survey_enabled'
  and current_config.value->>'round' = '2026-09 Final';
