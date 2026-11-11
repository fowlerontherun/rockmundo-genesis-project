// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const migration = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("seals real settlement results and rolls back the whole payout when a downstream write fails", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS
        'SELECT $1 = ''${id(1)}'' AND $2 = ''admin''';
      CREATE TABLE profiles(id uuid PRIMARY KEY, user_id uuid, deleted_at timestamptz, died_at timestamptz);
      CREATE TABLE bands(id uuid PRIMARY KEY, leader_id uuid, name text, band_balance integer, fame integer,
        collective_fame_earned integer DEFAULT 0);
      CREATE TABLE band_members(band_id uuid, profile_id uuid, member_status text);
      CREATE TABLE award_shows(id uuid PRIMARY KEY, show_name text, status text, ceremony_date timestamptz,
        categories jsonb, winner_fame_boost integer, winner_prize_money integer);
      CREATE TABLE award_nominations(id uuid PRIMARY KEY, award_show_id uuid, category_name text,
        nominee_type text, nominee_id text, nominee_name text, band_id uuid, status text,
        created_at timestamptz DEFAULT now());
      CREATE TABLE award_votes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nomination_id uuid,
        voter_type text, voter_id uuid, voter_account_id uuid, weight integer);
      CREATE TABLE award_wins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), award_show_id uuid,
        category_name text, winner_name text, band_id uuid, user_id uuid, fame_boost integer, prize_money integer);
      CREATE TABLE band_earnings(band_id uuid, amount integer, source text, description text,
        earned_by_user_id uuid, metadata jsonb);
      CREATE TABLE notifications(user_id uuid, profile_id uuid, category text, type text, title text,
        message text, action_path text, metadata jsonb);
      CREATE FUNCTION fixture_credit_earnings() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE public.bands SET band_balance=band_balance+NEW.amount WHERE id=NEW.band_id;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fixture_credit_earnings AFTER INSERT ON band_earnings
        FOR EACH ROW EXECUTE FUNCTION fixture_credit_earnings();
    `);
    await db.exec(migration("20261030180000_authoritative_awards_settlement.sql"));
    await db.exec(migration("20261030194500_awards_winner_receipt_notifications.sql"));
    await db.exec(migration("20261111153341_seal_awards_settlement_snapshot.sql"));

    await db.exec(`
      INSERT INTO profiles(id,user_id) VALUES ('${id(2)}','${id(3)}');
      INSERT INTO bands VALUES ('${id(4)}','${id(2)}','Fixture Band',1000,200);
      INSERT INTO award_shows VALUES ('${id(5)}','Fixture awards','nominations_open',now()+interval '1 day',
        '[{"name":"Best Band"}]',25,100);
      INSERT INTO award_nominations(id,award_show_id,category_name,nominee_type,nominee_id,nominee_name,band_id,status)
        VALUES ('${id(6)}','${id(5)}','Best Band','band','${id(4)}','Fixture Band','${id(4)}','shortlisted');
      UPDATE award_shows SET status='voting_open';
    `);
    const insertVote = (weight: number) => db.query(
      "INSERT INTO award_votes(nomination_id,voter_type,voter_id,voter_account_id,weight) VALUES ($1,'player',$2,$3,$4)",
      [id(6), id(2), id(3), weight],
    );
    await expect(db.query(`INSERT INTO award_nominations(id,award_show_id) VALUES ($1,$2)`,
      [id(7), id(5)])).rejects.toThrow("not accepting nominations");
    await expect(insertVote(2)).rejects.toThrow("Invalid weight");
    await insertVote(1);
    await db.query("UPDATE award_shows SET status='live', ceremony_date=now()-interval '1 minute' WHERE id=$1", [id(5)]);
    await expect(insertVote(1)).rejects.toThrow("open voting");
    await expect(db.query("UPDATE award_votes SET weight=2")).rejects.toThrow("open voting");
    await expect(db.query("DELETE FROM award_votes")).rejects.toThrow("open voting");

    const finalize = () => db.query<{ result: Record<string, unknown> }>(
      "SELECT public.award_admin_finalize_show($1) AS result", [id(5)],
    );
    await db.exec("SET ROLE authenticated");
    await expect(finalize()).rejects.toThrow("Only award administrators");
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(1)]);

    // Fail at the final snapshot write, after wins, fame, prize and notifications.
    await db.exec("ALTER TABLE award_settlement_snapshots ADD CONSTRAINT fixture_failure CHECK (false)");
    await db.exec("SET ROLE authenticated");
    await expect(finalize()).rejects.toThrow("fixture_failure");
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT status FROM award_shows")).rows).toEqual([{ status: "live" }]);
    expect((await db.query("SELECT band_balance,fame FROM bands")).rows).toEqual([{ band_balance: 1000, fame: 200 }]);
    for (const table of ["award_wins", "band_earnings", "notifications", "award_settlement_snapshots"]) {
      expect((await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows).toEqual([{ count: 0 }]);
    }
    await db.exec("ALTER TABLE award_settlement_snapshots DROP CONSTRAINT fixture_failure");

    await db.exec("SET ROLE authenticated");
    expect((await finalize()).rows[0].result).toMatchObject({ awards_issued: 1 });
    expect((await finalize()).rows[0].result).toMatchObject({ already_completed: true });
    await expect(db.query("SELECT * FROM award_settlement_snapshots")).rejects.toThrow("permission denied");
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT band_balance,fame FROM bands")).rows).toEqual([{ band_balance: 1100, fame: 225 }]);
    for (const table of ["award_wins", "band_earnings", "notifications", "award_settlement_snapshots"]) {
      expect((await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows).toEqual([{ count: 1 }]);
    }
    expect((await db.query("SELECT rules_version,nominations,ballots,winners FROM award_settlement_snapshots")).rows)
      .toMatchObject([{
        rules_version: "weighted-ballots-v1",
        nominations: [{ id: id(6), status: "winner" }],
        ballots: [{ nomination_id: id(6), voter_type: "player", weight: 1 }],
        winners: [{ band_id: id(4), fame: 25, money: 100 }],
      }]);
    expect((await db.query("SELECT ballots FROM award_settlement_snapshots")).rows[0].ballots)
      .toEqual([expect.not.objectContaining({ voter_account_id: id(3) })]);
    await expect(db.query("UPDATE award_shows SET status='voting_open'")).rejects.toThrow("cannot be reopened");
  } finally {
    await db.close();
  }
}, 30_000);
