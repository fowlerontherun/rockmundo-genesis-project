// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const sql = (path: string) => readFileSync(`supabase/migrations/${path}`, "utf8");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("processes offline pickups against real SQL, with preferences and durable replay", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA cron;
      CREATE TABLE cron.job (name text, schedule text, command text);
      CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS
        'INSERT INTO cron.job VALUES ($1,$2,$3); SELECT 1::bigint';
      CREATE TABLE profiles (id uuid PRIMARY KEY, user_id uuid, current_city_id uuid,
        is_active boolean DEFAULT true, died_at timestamptz, deleted_at timestamptz,
        is_traveling boolean DEFAULT false, travel_arrives_at timestamptz);
      CREATE TABLE band_members (band_id uuid, profile_id uuid, user_id uuid, member_status text,
        is_touring_member boolean DEFAULT false, travels_with_band boolean DEFAULT true, joined_at timestamptz);
      CREATE TABLE tours (id uuid PRIMARY KEY, band_id uuid, status text, cancelled boolean DEFAULT false, name text);
      CREATE TABLE cities (id uuid PRIMARY KEY, name text, country text);
      CREATE TABLE tour_travel_legs (id uuid PRIMARY KEY, tour_id uuid, from_city_id uuid, to_city_id uuid,
        departure_date timestamptz, arrival_date timestamptz, travel_duration_hours numeric,
        travel_mode text DEFAULT 'bus', status text DEFAULT 'scheduled');
      CREATE TABLE player_travel_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid, profile_id uuid, tour_leg_id uuid, from_city_id uuid, to_city_id uuid,
        transport_type text, cost_paid integer, departure_time timestamptz, scheduled_departure_time timestamptz,
        arrival_time timestamptz, travel_duration_hours numeric, status text);
      CREATE TABLE player_scheduled_activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid, profile_id uuid, activity_type text, status text, scheduled_start timestamptz,
        scheduled_end timestamptz, title text, description text, location text, metadata jsonb);
      CREATE TABLE travel_timeline_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid, user_id uuid, band_id uuid, tour_id uuid, tour_leg_id uuid,
        travel_history_id uuid, from_city_id uuid, to_city_id uuid, event_type text,
        message text, new_eta timestamptz, metadata jsonb);
      CREATE TABLE player_inbox (user_id uuid, category text, priority text, title text, message text,
        metadata jsonb, action_type text, action_data jsonb, related_entity_type text, related_entity_id uuid);
      CREATE TABLE travel_notification_preferences (profile_id uuid PRIMARY KEY, auto_rejoin_enabled boolean,
        in_app_enabled boolean, notify_rejoin_available boolean);
    `);
    await db.exec(sql("20261019084000_atomic_tour_rejoin_without_teleport.sql"));
    await db.exec(sql("20261111145055_server_tour_missed_pickups.sql"));

    for (let n = 1; n <= 5; n++) {
      await db.query("INSERT INTO profiles(id,user_id,current_city_id) VALUES ($1,$2,$3)", [
        uuid(n), uuid(n + 10), uuid(n === 4 ? 53 : 51),
      ]);
    }
    await db.exec(`
      INSERT INTO cities VALUES ('${uuid(51)}','London','UK'), ('${uuid(52)}','Bristol','UK'), ('${uuid(53)}','Leeds','UK');
      INSERT INTO tours(id,band_id,status,name) VALUES
        ('${uuid(21)}','${uuid(31)}','active','First tour'),
        ('${uuid(22)}','${uuid(32)}','booked','Second tour'),
        ('${uuid(23)}','${uuid(33)}','active','Mid-leg tour'),
        ('${uuid(24)}','${uuid(34)}','scheduled','Future-only tour');
      INSERT INTO band_members(band_id,profile_id,user_id,member_status) VALUES
        ('${uuid(31)}','${uuid(1)}','${uuid(11)}','active'),
        ('${uuid(32)}','${uuid(1)}','${uuid(11)}','active'),
        ('${uuid(31)}','${uuid(2)}','${uuid(12)}','active'),
        ('${uuid(33)}','${uuid(3)}','${uuid(13)}','active'),
        ('${uuid(31)}','${uuid(4)}','${uuid(14)}','active'),
        ('${uuid(34)}','${uuid(5)}','${uuid(15)}','active');
      INSERT INTO travel_notification_preferences VALUES ('${uuid(2)}',false,false,true);
    `);
    const leg = (id: number, tour: number, from: number, departure: number, arrival: number) =>
      db.query(`INSERT INTO tour_travel_legs(id,tour_id,from_city_id,to_city_id,departure_date,arrival_date)
        VALUES ($1,$2,$3,$4,now()+$5::int*interval '1 hour',now()+$6::int*interval '1 hour')`,
        [uuid(id), uuid(tour), uuid(from), uuid(52), departure, arrival]);
    await leg(61, 21, 51, -6, -4);
    await leg(62, 21, 52, 1, 2); // Unreachable pickup.
    await leg(63, 21, 51, 4, 7);
    await leg(64, 22, 51, -4, -2);
    await leg(65, 22, 51, 3, 5); // Earliest reachable pickup across tours.
    await leg(66, 23, 51, -1, 1);
    await leg(67, 24, 51, 1, 3); // No missed departure.
    await db.query(`INSERT INTO player_travel_history(profile_id,tour_leg_id,status)
      VALUES ($1,$2,'scheduled')`, [uuid(2), uuid(61)]);
    await db.exec("SET ROLE authenticated");
    await expect(db.query("SELECT public.process_tour_pickups()")).rejects.toThrow(/permission denied/);
    await db.exec("SET ROLE service_role");
    const run = () => db.query<{ result: { booked: number; missed: number; failures: number } }>(
      "SELECT public.process_tour_pickups() result",
    );
    expect((await run()).rows[0].result).toEqual({ booked: 2, missed: 4, failures: 0 });
    expect((await run()).rows[0].result).toEqual({ booked: 0, missed: 0, failures: 0 });
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT profile_id,tour_leg_id,status FROM player_travel_history ORDER BY profile_id")).rows)
      .toEqual([
        { profile_id: uuid(1), tour_leg_id: uuid(65), status: "scheduled" },
        { profile_id: uuid(2), tour_leg_id: uuid(61), status: "cancelled" },
        { profile_id: uuid(3), tour_leg_id: uuid(66), status: "in_progress" },
      ]);
    expect((await db.query("SELECT id,is_traveling,current_city_id FROM profiles ORDER BY id")).rows)
      .toEqual([1, 2, 3, 4, 5].map(n => ({
        id: uuid(n), is_traveling: n === 3, current_city_id: uuid(n === 4 ? 53 : 51),
      })));
    expect((await db.query("SELECT user_id FROM player_inbox ORDER BY user_id")).rows)
      .toEqual([{ user_id: uuid(11) }, { user_id: uuid(11) }, { user_id: uuid(14) }]);
    expect((await db.query("SELECT command FROM cron.job")).rows)
      .toEqual([{ command: "SELECT public.process_tour_pickups()" }]);
  } finally {
    await db.close();
  }
}, 30_000);
