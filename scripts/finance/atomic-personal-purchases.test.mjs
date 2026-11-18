import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../supabase/migrations/20261118163000_atomic_personal_purchases_4235_4245.sql', import.meta.url), 'utf8');
const u1 = '00000000-0000-4000-8000-000000000001';
const u2 = '00000000-0000-4000-8000-000000000002';
const p1 = '00000000-0000-4000-8000-000000000011';
const p2 = '00000000-0000-4000-8000-000000000022';
const p3 = '00000000-0000-4000-8000-000000000023';
const city = '00000000-0000-4000-8000-000000000033';
const parlour = '00000000-0000-4000-8000-000000000044';
const artist = '00000000-0000-4000-8000-000000000055';
const song1 = '00000000-0000-4000-8000-000000000066';
const song2 = '00000000-0000-4000-8000-000000000077';
const video1 = '00000000-0000-4000-8000-000000000088';
const video2 = '00000000-0000-4000-8000-000000000099';
const infection = '00000000-0000-4000-8000-0000000000aa';
const key = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const fixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),cash bigint NOT NULL,
  fame integer NOT NULL DEFAULT 0,current_city_id uuid,is_active boolean DEFAULT true,
  died_at timestamptz,deleted_at timestamptz
);
CREATE FUNCTION public.current_active_player_profile_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT id FROM public.profiles WHERE user_id=auth.uid() AND is_active IS TRUE
     AND died_at IS NULL AND deleted_at IS NULL ORDER BY id LIMIT 1 $$;
CREATE TABLE public.tattoo_parlours(
  id uuid PRIMARY KEY,city_id uuid,quality_tier integer,price_multiplier numeric,infection_risk numeric
);
CREATE TABLE public.tattoo_artists(
  id uuid PRIMARY KEY,parlour_id uuid,price_premium numeric,quality_bonus integer,
  accepts_custom boolean,total_tattoos_done integer DEFAULT 0
);
CREATE TABLE public.player_tattoos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),
  profile_id uuid REFERENCES public.profiles(id),tattoo_design_id uuid,parlour_id uuid,
  artist_id uuid,body_slot text NOT NULL CHECK (body_slot <> 'back'),
  quality_score integer NOT NULL,ink_color text,price_paid integer,is_infected boolean,
  infection_cleared_at timestamptz,custom_text text,font_style text
);
CREATE TABLE public.custom_tattoo_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),
  artist_id uuid,description text,body_slot text,status text,quoted_price numeric,
  estimated_quality integer,completed_tattoo_id uuid REFERENCES public.player_tattoos(id),
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.songs(
  id uuid PRIMARY KEY,user_id uuid NOT NULL,profile_id uuid,band_id uuid,status text
);
CREATE TABLE public.band_members(band_id uuid,user_id uuid,profile_id uuid,member_status text);
CREATE TABLE public.releases(id uuid PRIMARY KEY,user_id uuid,band_id uuid,release_status text);
CREATE TABLE public.release_songs(release_id uuid,song_id uuid);
CREATE TABLE public.music_videos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),song_id uuid REFERENCES public.songs(id),
  release_id uuid,title text CHECK (title <> 'blocked'),description text,budget numeric,production_quality integer,
  status text,views_count bigint,earnings numeric,hype_score integer
);
INSERT INTO auth.users VALUES ('${u1}'),('${u2}');
INSERT INTO public.profiles(id,user_id,cash,fame,current_city_id) VALUES
  ('${p1}','${u1}',20000,200,'${city}'),('${p2}','${u2}',10,0,'${city}');
INSERT INTO public.profiles(id,user_id,cash,fame,current_city_id,is_active)
  VALUES('${p3}','${u1}',10000,200,'${city}',false);
INSERT INTO public.tattoo_parlours VALUES('${parlour}','${city}',3,1,0.1);
INSERT INTO public.tattoo_artists VALUES('${artist}','${parlour}',1,10,true,0);
INSERT INTO public.player_tattoos(id,user_id,profile_id,body_slot,quality_score,price_paid,is_infected)
  VALUES('${infection}','${u1}','${p1}','right_forearm',60,100,true);
INSERT INTO public.songs VALUES('${song1}','${u1}','${p1}',null,'recorded'),
  ('${song2}','${u2}','${p2}',null,'recorded');
INSERT INTO public.music_videos(id,song_id,title,budget,production_quality,status,views_count,earnings,hype_score)
  VALUES('${video1}','${song1}','Mine',5000,80,'released',100,0,5),
  ('${video2}','${song2}','Other',5000,80,'released',100,0,5);
`;

test('atomic tattoo/video purchase RPCs commit only authorized, exactly-once effects', async () => {
  const db = new PGlite();
  try {
    // Full forward migration over representative production-compatible table shapes.
    await db.exec(fixture);
    await db.exec(migration);
    const acl=(await db.query(`SELECT
      has_function_privilege('anon','public.purchase_personal_tattoo_atomic(uuid,uuid,text,uuid,uuid,text,text,text,text,uuid)','EXECUTE') AS tattoo_anon,
      has_function_privilege('anon','public.purchase_music_video_atomic(uuid,uuid,text,uuid,uuid,integer,text,text,text,text,uuid)','EXECUTE') AS video_anon,
      has_function_privilege('authenticated','public.purchase_personal_tattoo_atomic(uuid,uuid,text,uuid,uuid,text,text,text,text,uuid)','EXECUTE') AS tattoo_player,
      has_function_privilege('authenticated','public.purchase_music_video_atomic(uuid,uuid,text,uuid,uuid,integer,text,text,text,text,uuid)','EXECUTE') AS video_player`)).rows[0];
    assert.deepEqual(acl,{tattoo_anon:false,video_anon:false,tattoo_player:true,video_player:true});
    await db.exec(`SET request.jwt.claim.sub='${u1}'`);

    const tattoo = async (id, kind, opts = {}) => {
      const a = [id,p1,kind,opts.parlour ?? null,opts.artist ?? null,
        opts.slot ?? null,opts.text ?? null,opts.font ?? null,opts.description ?? null,
        opts.tattoo ?? null];
      const r = await db.query(`SELECT public.purchase_personal_tattoo_atomic(
        $1::uuid,$2::uuid,$3::text,$4::uuid,$5::uuid,$6::text,
        $7::text,$8::text,$9::text,$10::uuid) AS value`,a);
      return r.rows[0].value;
    };
    const video = async (id,action,opts = {}) => {
      const a=[id,p1,action,opts.song ?? null,opts.video ?? null,opts.budget ?? null,
        opts.style ?? null,opts.option ?? null,opts.title ?? null,
        opts.description ?? null,opts.release ?? null];
      const r=await db.query(`SELECT public.purchase_music_video_atomic(
        $1::uuid,$2::uuid,$3::text,$4::uuid,$5::uuid,$6::integer,
        $7::text,$8::text,$9::text,$10::text,$11::uuid) AS value`,a);
      return r.rows[0].value;
    };
    const cash = async () => Number((await db.query('SELECT cash FROM public.profiles WHERE id=$1',[p1])).rows[0].cash);
    const count = async (table) => Number((await db.query(`SELECT count(*)::integer AS n FROM public.${table}`)).rows[0].n);

    // Failed insert must roll back the debit as well as the attempted tattoo.
    const before = await cash();
    await assert.rejects(db.query(`SELECT public.purchase_personal_tattoo_atomic($1::uuid,$2::uuid,'text')`,
      [key(99),p3]),/active character/);
    await assert.rejects(tattoo(key(100),'text',{parlour,slot:'back',text:'fail',font:'gothic'}),/check constraint/i);
    assert.equal(await cash(),before);
    assert.equal(await count('personal_purchase_receipts'),0);

    await assert.rejects(tattoo(key(101),'text',{parlour,slot:'left_forearm',text:'Hello',font:'bogus'}),/Unknown tattoo font/);
    const text = {parlour,artist,slot:'left_forearm',text:'Hello',font:'script'};
    const t1=await tattoo(key(102),'text',text);
    assert.equal(t1.price,180);
    assert.equal(await cash(),before-180);
    assert.deepEqual(await tattoo(key(102),'text',text),t1);
    assert.equal(await cash(),before-180);
    await assert.rejects(tattoo(key(102),'text',{...text,text:'Different'}),/reused/);
    await assert.rejects(tattoo(key(103),'text',{...text,text:'Other'}),/occupied/);

    const custom={parlour,artist,slot:'left_upper_arm',description:'A phoenix with musical notes'};
    const t2=await tattoo(key(104),'custom',custom);
    assert.equal(t2.price,450);
    const req=(await db.query('SELECT profile_id,completed_tattoo_id FROM public.custom_tattoo_requests')).rows[0];
    assert.equal(req.profile_id,p1);
    assert.equal(req.completed_tattoo_id,t2.tattoo_id);
    assert.deepEqual(await tattoo(key(104),'custom',custom),t2);

    // Foreign or uninfected tattoos must not cost money.
    const c=await cash();
    await assert.rejects(tattoo(key(105),'treatment',{tattoo:video2}),/no untreated infection/);
    assert.equal(await cash(),c);
    const treat=await tattoo(key(106),'treatment',{tattoo:infection});
    assert.equal(treat.price,200);
    assert.deepEqual(await tattoo(key(106),'treatment',{tattoo:infection}),treat);
    await assert.rejects(tattoo(key(107),'treatment',{tattoo:infection}),/no untreated infection/);

    await assert.rejects(video(key(108),'production',{song:song2,budget:2500,style:'standard',title:'Not mine'}),/Song not owned/);
    await assert.rejects(video(key(109),'production',{song:song1,budget:0,style:'standard',title:'Free'}),/Invalid video budget/);
    const beforeFailedVideo=await cash();
    await assert.rejects(video(key(118),'production',{song:song1,budget:2500,style:'standard',title:'blocked'}),/check constraint/i);
    assert.equal(await cash(),beforeFailedVideo);
    const newVideo={song:song1,budget:2500,style:'premium',title:'Actual music video'};
    const v1=await video(key(110),'production',newVideo);
    assert.equal(v1.price,2500);
    assert.deepEqual(await video(key(110),'production',newVideo),v1);
    assert.equal((await db.query('SELECT production_quality FROM public.music_videos WHERE id=$1',[v1.video_id])).rows[0].production_quality,65);
    await assert.rejects(video(key(111),'tv',{video:video2,option:'fuse_daily'}),/Song not owned/);
    await assert.rejects(video(key(112),'tv',{video:video1,option:'mtv_trl'}),/requires more fame/);
    const tv={video:video1,option:'fuse_daily'};
    const placed=await video(key(113),'tv',tv);
    assert.equal(placed.price,3000);
    assert.deepEqual(await video(key(113),'tv',tv),placed);
    await assert.rejects(video(key(114),'tv',tv),/already been placed/);
    const promo=await video(key(115),'promo',{video:video1,option:'press_release'});
    assert.equal(promo.price,1000);
    const stats=(await db.query('SELECT views_count,hype_score,earnings FROM public.music_videos WHERE id=$1',[video1])).rows[0];
    assert.equal(Number(stats.views_count),7100); // initial 100 + TV 5000 + press 2000
    assert.equal(stats.hype_score,13);
    assert.equal(Number(stats.earnings),4);
    assert.equal(await cash(),20000-180-450-200-2500-3000-1000);

    // Another account cannot reuse an earlier purchase ID or reach this profile.
    await db.exec(`SET request.jwt.claim.sub='${u2}'`);
    await assert.rejects(db.query(`SELECT public.purchase_personal_tattoo_atomic(
      $1::uuid,$2::uuid,'text',$3::uuid,NULL,'chest','Hello','gothic')`,
      [key(117),p2,parlour]),/Insufficient funds/);
    await assert.rejects(tattoo(key(102),'text',text),/active character/);
    await assert.rejects(video(key(113),'tv',tv),/active character/);
    await db.exec('RESET request.jwt.claim.sub');
    await assert.rejects(tattoo(key(116),'treatment',{tattoo:infection}),/unauthenticated/);
  } finally {
    await db.close();
  }
});
