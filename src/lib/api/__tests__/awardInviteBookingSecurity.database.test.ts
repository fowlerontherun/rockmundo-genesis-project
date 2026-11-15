// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const dir = "supabase/migrations";
const migration = (name: string) => readFileSync(`${dir}/${name}`, "utf8");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("allows only authorised award recipients to see terms or settle a booking", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS
        'SELECT $1 = ''${id(1)}'' AND $2 = ''admin''';
      CREATE FUNCTION public.caller_can_act_for_band(uuid) RETURNS boolean LANGUAGE sql AS
        'SELECT $1 = ''${id(5)}'' AND auth.uid() = ''${id(2)}''';
      CREATE TABLE profiles(id uuid PRIMARY KEY, user_id uuid);
      GRANT SELECT ON profiles TO authenticated;
      ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Own profiles" ON profiles FOR SELECT TO authenticated USING (user_id=auth.uid());
      CREATE TABLE award_shows(id uuid PRIMARY KEY, status text);
      CREATE TABLE award_show_invites(
        id uuid PRIMARY KEY, award_show_id uuid, invitee_band_id uuid, invitee_user_id uuid,
        invite_type text, slot_label text, stage text, response_status text DEFAULT 'pending',
        responded_at timestamptz, updated_at timestamptz, message text, performance_fee integer
      );
      CREATE TABLE award_performance_bookings(
        award_show_id uuid, band_id uuid, user_id uuid, slot_label text, stage text,
        song_ids uuid[], status text, UNIQUE(award_show_id,slot_label)
      );
      ALTER TABLE award_show_invites ENABLE ROW LEVEL SECURITY;
      ALTER TABLE award_performance_bookings ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, UPDATE ON award_show_invites TO anon, authenticated;
      GRANT SELECT, INSERT ON award_performance_bookings TO authenticated;
      CREATE POLICY "Admins manage invites" ON award_show_invites FOR ALL TO authenticated
        USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
      CREATE POLICY "Award invites are viewable by everyone" ON award_show_invites FOR SELECT USING (true);
      CREATE POLICY "Invitees can respond to invites" ON award_show_invites FOR UPDATE USING (true);
      CREATE POLICY "Users can book performances" ON award_performance_bookings FOR INSERT WITH CHECK (true);
      INSERT INTO profiles VALUES ('${id(8)}','${id(2)}');
      INSERT INTO award_shows VALUES ('${id(4)}','upcoming');
      INSERT INTO award_show_invites
        (id,award_show_id,invitee_band_id,invitee_user_id,invite_type,slot_label,stage,message,performance_fee)
      VALUES ('${id(6)}','${id(4)}','${id(5)}',NULL,'performer','Closing set','Main Stage','Private offer',500),
        ('${id(9)}','${id(4)}',NULL,'${id(8)}','attendee',NULL,NULL,'Profile invitation',0),
        ('${id(10)}','${id(4)}',NULL,'${id(2)}','attendee',NULL,NULL,'Account invitation',0);
    `);
    await db.exec(migration("20261030114500_private_award_invites_and_bookings.sql"));
    await db.exec(migration("20261030133000_atomic_award_invitation_responses.sql")
      .split("-- An admin may revise")[0]);
    const patch = readdirSync(dir).find((name) => name.endsWith("_fail_closed_award_invite_response.sql"))!;
    await db.exec(migration(patch));

    const respond = (inviteId = id(6), response = "accepted") => db.query(
      "SELECT (award_show_respond_invite($1,$2)).response_status AS status", [inviteId, response],
    );
    const asUser = async (userId: string) => {
      await db.exec("SET ROLE authenticated");
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [userId]);
    };
    const visible = () => db.query("SELECT id,message,performance_fee FROM award_show_invites ORDER BY id");

    await db.exec("SET ROLE anon");
    await expect(visible()).rejects.toThrow("permission denied");
    await expect(respond()).rejects.toThrow("permission denied");
    await asUser(id(3));
    expect((await visible()).rows).toEqual([]);
    await expect(respond()).rejects.toThrow("Invitation is unavailable to this account");
    await expect(respond(id(7))).rejects.toThrow("Invitation is unavailable to this account");
    await expect(db.query("INSERT INTO award_performance_bookings(user_id,band_id) VALUES ($1,$2)", [id(3), id(5)]))
      .rejects.toThrow("row-level security");

    await asUser(id(2));
    expect((await visible()).rows).toHaveLength(3);
    expect((await db.query("UPDATE award_show_invites SET performance_fee=900 RETURNING id")).rows).toEqual([]);
    expect((await respond()).rows).toEqual([{ status: "accepted" }]);
    expect((await respond()).rows).toEqual([{ status: "accepted" }]);
    expect((await respond(id(9))).rows).toEqual([{ status: "accepted" }]);
    expect((await respond(id(10))).rows).toEqual([{ status: "accepted" }]);
    await expect(respond(id(6), "declined")).rejects.toThrow("already been answered");
    await asUser(id(3));
    await expect(respond()).rejects.toThrow("Invitation is unavailable to this account");

    await asUser(id(1));
    expect((await visible()).rows).toContainEqual({ id: id(6), message: "Private offer", performance_fee: 500 });
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT band_id,user_id,slot_label,status FROM award_performance_bookings")).rows)
      .toEqual([{ band_id: id(5), user_id: id(2), slot_label: "Closing set", status: "confirmed" }]);
  } finally {
    await db.close();
  }
}, 30_000);
