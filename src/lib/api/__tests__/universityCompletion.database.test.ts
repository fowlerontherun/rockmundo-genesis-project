// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const migration = readFileSync("supabase/migrations/20261105171501_17310d55-d741-42d8-8bde-07102a23f5af.sql", "utf8");
const profile = "00000000-0000-4000-8000-000000000001";
const course = "00000000-0000-4000-8000-000000000002";
let sequence = 10;

async function enrollment(offset: string, xp = 1000, auto = true) {
  const id = `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
  await db.query(`INSERT INTO public.player_university_enrollments
    (id,profile_id,course_id,scheduled_end_date,status,total_xp_earned,auto_attend)
    VALUES ($1,$2,$3,now()+$4::interval,'in_progress',$5,$6)`, [id, profile, course, offset, xp, auto]);
  if (xp > 0) await db.query("INSERT INTO public.player_university_attendance(enrollment_id,xp_earned,was_locked_out) VALUES($1,$2,false)", [id, xp]);
  return id;
}

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE SCHEMA cron;
    CREATE FUNCTION cron.schedule(text,text,text) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
    CREATE TYPE public.enrollment_status AS ENUM('enrolled','in_progress','completed','dropped');
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,user_id uuid,experience numeric DEFAULT 0);
    CREATE TABLE public.university_courses(id uuid PRIMARY KEY,skill_slug text);
    CREATE TABLE public.player_university_enrollments(id uuid PRIMARY KEY,profile_id uuid,course_id uuid,scheduled_end_date timestamptz,status public.enrollment_status,total_xp_earned integer,actual_completion_date timestamptz,updated_at timestamptz,auto_attend boolean);
    CREATE TABLE public.player_university_attendance(enrollment_id uuid,xp_earned integer,was_locked_out boolean);
    CREATE TABLE public.skill_progress(id uuid DEFAULT gen_random_uuid(),profile_id uuid,skill_slug text,current_level integer,current_xp integer,required_xp integer,last_practiced_at timestamptz,updated_at timestamptz,UNIQUE(profile_id,skill_slug));
    CREATE TABLE public.experience_ledger(user_id uuid,profile_id uuid,activity_type text,xp_amount integer,skill_slug text,metadata jsonb);
    CREATE FUNCTION public.progression_skill_max_level(text) RETURNS integer LANGUAGE sql AS $$ SELECT 20 $$;
    CREATE FUNCTION public.progression_skill_required_xp(integer) RETURNS integer LANGUAGE sql AS $$ SELECT 100 $$;
    INSERT INTO public.profiles(id,user_id) VALUES('${profile}','${profile}');
    INSERT INTO public.university_courses VALUES('${course}','guitar');
  `);
  await db.exec(migration);
}, 30_000);
afterAll(async () => { await db.close(); });

describe("university deadline completion and post-course XP", () => {
  it("finishes an overdue course even when its last attendance was already recorded", async () => {
    const id = await enrollment("-1 day", 995);
    await db.query("SELECT public.finish_due_university_courses()");
    const { rows } = await db.query<{status: string; on_time: boolean; total_xp_earned: number}>("SELECT status,actual_completion_date=scheduled_end_date AS on_time,total_xp_earned FROM public.player_university_enrollments WHERE id=$1", [id]);
    expect(rows[0]).toEqual({status: "completed", on_time: true, total_xp_earned: 1194});
  });
  it("does not complete a course before its saved duration expires", async () => {
    const id = await enrollment("1 day");
    await db.query("SELECT public.finalize_university_course($1)", [id]);
    const { rows } = await db.query<{status:string}>("SELECT status FROM public.player_university_enrollments WHERE id=$1", [id]);
    expect(rows[0].status).toBe("in_progress");
  });
  it("finishes manual-attendance courses without requiring another class", async () => {
    const id = await enrollment("-1 second", 500, false);
    await db.query("SELECT public.finish_due_university_courses()");
    const {rows} = await db.query<{bonus_xp:number}>("SELECT bonus_xp FROM public.university_course_completions WHERE enrollment_id=$1",[id]);
    expect(rows[0].bonus_xp).toBe(100);
  });
  it("awards 20% of verified attendance XP, rounding down", async () => {
    const {rows} = await db.query<{bonus:number}>("SELECT public.university_completion_bonus(709) AS bonus");
    expect(rows[0].bonus).toBe(141);
  });
  it("retries cannot grant the completion bonus twice", async () => {
    const id = await enrollment("-1 day", 1000);
    await db.query("SELECT public.finalize_university_course($1)",[id]);
    await db.query("SELECT public.finalize_university_course($1)",[id]);
    const {rows} = await db.query<{awards:number;xp:number}>("SELECT count(*)::integer AS awards,sum(xp_amount)::integer AS xp FROM public.experience_ledger WHERE metadata->>'enrollment_id'=$1",[id]);
    expect(rows[0]).toEqual({awards:1,xp:200});
  });
  it("does not invent XP for courses with no attended classes", async () => {
    const id = await enrollment("-1 day", 0, false);
    await db.query("SELECT public.finalize_university_course($1)",[id]);
    const {rows} = await db.query<{bonus_xp:number}>("SELECT bonus_xp FROM public.university_course_completions WHERE enrollment_id=$1",[id]);
    expect(rows[0].bonus_xp).toBe(0);
  });
  it("players cannot call the privileged completion reward", async () => {
    const {rows} = await db.query<{allowed:boolean}>("SELECT has_function_privilege('authenticated','public.finalize_university_course(uuid)','execute') AS allowed");
    expect(rows[0].allowed).toBe(false);
  });
});