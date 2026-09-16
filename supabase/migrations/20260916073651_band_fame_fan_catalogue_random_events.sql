alter table public.random_events
  add column if not exists band_fame_min integer,
  add column if not exists band_fame_max integer,
  add column if not exists band_fans_min integer,
  add column if not exists band_fans_max integer,
  add column if not exists requires_released_music boolean not null default false,
  add column if not exists release_age_min_days integer,
  add column if not exists release_age_max_days integer,
  add column if not exists target_release_type text;

alter table public.player_events
  add column if not exists target_release_id uuid references public.releases(id) on delete set null;

create index if not exists idx_player_events_target_release_id
  on public.player_events(target_release_id)
  where target_release_id is not null;

create or replace function private.apply_catalogue_event_release_hype()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_boost integer := 0;
  v_release_title text;
  v_new_hype integer;
begin
  if coalesce(new.outcome_applied, false) = true
     and coalesce(old.outcome_applied, false) = false
     and new.target_release_id is not null
     and new.outcome_effects ? 'release_hype' then
    begin
      v_boost := coalesce((new.outcome_effects ->> 'release_hype')::integer, 0);

      if v_boost <> 0 then
        update public.releases r
        set hype_score = least(1500, greatest(0, coalesce(r.hype_score, 0) + v_boost)),
            updated_at = now()
        where r.id = new.target_release_id
          and r.release_status = 'released'
          and exists (
            select 1
            from public.band_members bm
            where bm.band_id = r.band_id
              and coalesce(bm.is_touring_member, false) = false
              and (
                (new.profile_id is not null and bm.profile_id = new.profile_id)
                or (new.profile_id is null and bm.user_id = new.user_id)
              )
          )
        returning r.title, r.hype_score into v_release_title, v_new_hype;

        if found then
          insert into public.activity_feed(user_id, activity_type, message, metadata)
          values (
            new.user_id,
            'catalogue_resurgence',
            format('Catalogue resurgence: "%s" gained %s release momentum', v_release_title, case when v_boost > 0 then '+' || v_boost::text else v_boost::text end),
            jsonb_build_object(
              'player_event_id', new.id,
              'event_id', new.event_id,
              'release_id', new.target_release_id,
              'release_title', v_release_title,
              'release_hype_change', v_boost,
              'release_hype_after', v_new_hype
            )
          );
        end if;
      end if;
    exception when others then
      raise warning 'Failed to apply catalogue release hype for player_event %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

revoke all on function private.apply_catalogue_event_release_hype() from public, anon, authenticated;

drop trigger if exists trg_apply_catalogue_event_release_hype on public.player_events;
create trigger trg_apply_catalogue_event_release_hype
after update of outcome_applied, outcome_effects on public.player_events
for each row
execute function private.apply_catalogue_event_release_hype();

insert into public.random_events (
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text,
  is_active, band_fame_min, band_fans_min,
  requires_released_music, release_age_min_days, target_release_type
)
select * from (values
  (
    'Back Catalogue Rediscovered',
    'A wave of newer fans has started digging through your older releases. One track in particular is suddenly getting shared again.',
    'industry', false,
    'Feed the momentum', '{"cash":-250,"fans":75,"fame":25,"release_hype":140}'::jsonb,
    'You put a little promotion behind the rediscovery. The older release gets a noticeable lift in both sales and streams.',
    'Let the fans own it', '{"fans":125,"fame":15,"release_hype":90}'::jsonb,
    'You leave the moment to the fans. Word of mouth grows naturally and the release starts moving again.',
    true, 100, 250, true, 3, null
  ),
  (
    'Fan-Made Clip Goes Viral',
    'A fan-made video using one of your older songs has exploded across social media and thousands of people are trying to find the original track.',
    'social', false,
    'Jump on the trend', '{"cash":-750,"fans":250,"fame":70,"release_hype":240}'::jsonb,
    'You react quickly with clips and links of your own. The original release gets a strong new burst of attention.',
    'Stay hands-off', '{"fans":325,"fame":45,"release_hype":170}'::jsonb,
    'You let the clip keep spreading without forcing it. The song still enjoys a healthy second life.',
    true, 500, 1000, true, 4, null
  ),
  (
    'Deep Cut Becomes a Cult Favourite',
    'Fans have unexpectedly latched onto an older deep cut. It is appearing in playlists, fan pages and requests despite never being a major hit first time around.',
    'career', false,
    'Reissue and promote it', '{"cash":-2000,"fans":500,"fame":120,"release_hype":330}'::jsonb,
    'The renewed push works. The forgotten track becomes a genuine catalogue success and starts shifting units again.',
    'Keep it as a fan secret', '{"fans":650,"fame":80,"release_hype":230}'::jsonb,
    'The track keeps its cult status, but the fan buzz still creates a meaningful sales and streaming bump.',
    true, 1500, 3000, true, 5, null
  ),
  (
    'Influencer Revives an Old Track',
    'A huge creator has used one of your older releases in a breakout video. Their audience is now flooding to the original recording.',
    'social', false,
    'Launch a coordinated campaign', '{"cash":-5000,"fans":1000,"fame":220,"release_hype":470}'::jsonb,
    'Your team capitalises on the exposure. The old release surges across streaming services and starts selling strongly again.',
    'Take the organic boost', '{"fans":1250,"fame":160,"release_hype":340}'::jsonb,
    'You avoid overplaying it. The creator-driven discovery still gives the release a major resurgence.',
    true, 3000, 7500, true, 6, null
  ),
  (
    'Prime-Time TV Needle Drop',
    'One of your older singles has been used in a major television drama during a key scene. Viewers are searching for the track immediately.',
    'industry', false,
    'Promote the placement heavily', '{"cash":-10000,"fans":2200,"fame":450,"release_hype":650}'::jsonb,
    'The placement becomes a talking point and the promotional push turns it into a substantial catalogue hit.',
    'Let the scene do the work', '{"fans":2600,"fame":350,"release_hype":500}'::jsonb,
    'The scene connects with viewers. The single climbs back into circulation without much help from you.',
    true, 6000, 12000, true, 7, 'single'
  ),
  (
    'Festival Crowd Revives an Old Anthem',
    'Clips of festival crowds singing one of your older tracks have spread everywhere. Fans who missed it first time around are discovering it now.',
    'career', false,
    'Turn it into an anthem campaign', '{"cash":-15000,"fans":3500,"fame":650,"release_hype":760}'::jsonb,
    'The campaign catches fire. The old song becomes a live anthem and its catalogue numbers jump sharply.',
    'Keep it spontaneous', '{"fans":4200,"fame":500,"release_hype":560}'::jsonb,
    'You keep the moment authentic. The live clips continue driving a large wave of new listeners and buyers.',
    true, 9000, 18000, true, 7, null
  ),
  (
    'Old Single Lands in a Huge Film',
    'A blockbuster film has licensed one of your older singles for a major sequence. Millions of viewers are about to hear the track.',
    'industry', false,
    'Exploit the global moment', '{"cash":-25000,"fans":6500,"fame":1200,"release_hype":1050}'::jsonb,
    'The film placement becomes a massive second wind for the single. Sales and streams explode as a new audience discovers it.',
    'Let the film drive discovery', '{"fans":7800,"fame":950,"release_hype":820}'::jsonb,
    'The film does the heavy lifting. The single enjoys a huge global resurgence and races back into people''s libraries.',
    true, 12000, 25000, true, 10, 'single'
  ),
  (
    'Global Sports Montage Uses Your Classic',
    'Your older track has been selected for a globally televised sports montage. The exposure puts the song in front of an enormous mainstream audience.',
    'industry', false,
    'Run a worldwide catalogue campaign', '{"cash":-50000,"fans":10000,"fame":1800,"release_hype":1250}'::jsonb,
    'The campaign and broadcast reinforce each other. The old release becomes unavoidable and posts its biggest numbers in years.',
    'Ride the broadcast wave', '{"fans":12000,"fame":1450,"release_hype":950}'::jsonb,
    'The broadcast alone is enough to spark a major worldwide revival for the release.',
    true, 20000, 40000, true, 14, null
  )
) as v(
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text,
  is_active, band_fame_min, band_fans_min,
  requires_released_music, release_age_min_days, target_release_type
)
where not exists (
  select 1 from public.random_events existing where existing.title = v.title
);
