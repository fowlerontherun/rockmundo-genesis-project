// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const sql = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const profile = "00000000-0000-4000-8000-000000000001";
const band = "00000000-0000-4000-8000-000000000002";
const video = "00000000-0000-4000-8000-000000000003";
const request = "00000000-0000-4000-8000-000000000004";
const nextRequest = "00000000-0000-4000-8000-000000000005";

it("allows only paid tip receipts and replays the same wallet debit and treasury credit once", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE TABLE profiles (id uuid PRIMARY KEY, user_id uuid, cash integer);
      CREATE FUNCTION current_player_profile_id() RETURNS uuid LANGUAGE sql AS
        $$ SELECT id FROM public.profiles WHERE user_id = auth.uid() $$;
      CREATE TABLE bands (id uuid PRIMARY KEY, band_balance integer);
      CREATE TABLE dikcok_videos (id uuid PRIMARY KEY, band_id uuid REFERENCES bands(id));
      CREATE TABLE dikcok_fan_tips (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), video_id uuid REFERENCES dikcok_videos(id),
        tipper_profile_id uuid REFERENCES profiles(id), amount integer, message text
      );
      GRANT INSERT ON dikcok_fan_tips TO authenticated;
      CREATE TABLE band_treasuries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid REFERENCES bands(id),
        is_primary boolean, currency_code text, balance_minor bigint, reserved_balance_minor bigint,
        updated_at timestamptz, created_at timestamptz DEFAULT now()
      );
      CREATE TABLE band_treasury_transactions (
        band_id uuid, treasury_id uuid, profile_id uuid, direction text, amount_minor bigint,
        currency_code text, source_kind text, category text, note text,
        idempotency_key text UNIQUE, balance_after_minor bigint
      );
      INSERT INTO profiles VALUES ('${profile}', '${profile}', 25);
      INSERT INTO bands VALUES ('${band}', 10);
      INSERT INTO dikcok_videos VALUES ('${video}', '${band}');
      INSERT INTO band_treasuries (band_id, is_primary, currency_code, balance_minor, reserved_balance_minor)
        VALUES ('${band}', true, 'USD', 1025, 300);
    `);
    // Install the production debit function without the unrelated booking RPCs.
    const booking = sql("20260823183500_finance_a1_atomic_bookings");
    await db.exec(booking.slice(
      booking.indexOf("CREATE OR REPLACE FUNCTION public._debit_atomic_booking_payment("),
      booking.indexOf("-- Rehearsal booking authority"),
    ));
    await db.exec(sql("20261114175625_dikcok_tip_treasury"));

    const send = (amount: number, requestId = request) =>
      db.query("SELECT public.send_dikcok_tip($1, $2, $3) AS id", [video, amount, requestId]);

    await db.exec("SET ROLE anon");
    await expect(send(10)).rejects.toThrow(/permission denied/);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${profile}'`);
    await expect(db.exec(`INSERT INTO dikcok_fan_tips (video_id, tipper_profile_id, amount)
      VALUES ('${video}', '${profile}', 50)`)).rejects.toThrow(/permission denied/);
    await expect(send(6)).rejects.toThrow(/invalid_dikcok_tip/);
    await expect(send(50)).rejects.toThrow(/insufficient_personal_funds/);

    const receipt = await send(10);
    expect((await send(10)).rows).toEqual(receipt.rows);
    await expect(send(5)).rejects.toThrow(/dikcok_tip_request_mismatch/);

    await db.exec("RESET ROLE; UPDATE band_treasuries SET currency_code = 'GBP'; SET ROLE authenticated");
    await expect(send(5, nextRequest)).rejects.toThrow(/dikcok_tip_usd_treasury_missing/);
    await db.exec("RESET ROLE");

    expect((await db.query("SELECT cash FROM profiles")).rows).toEqual([{ cash: 15 }]);
    expect((await db.query("SELECT band_balance FROM bands")).rows).toEqual([{ band_balance: 20 }]);
    expect((await db.query("SELECT balance_minor, reserved_balance_minor FROM band_treasuries")).rows)
      .toEqual([{ balance_minor: 2025, reserved_balance_minor: 300 }]);
    expect((await db.query("SELECT direction, amount_minor FROM band_treasury_transactions")).rows)
      .toEqual([{ direction: "credit", amount_minor: 1000 }]);
    expect((await db.query("SELECT amount FROM dikcok_fan_tips")).rows).toEqual([{ amount: 10 }]);
  } finally {
    await db.close();
  }
}, 30_000);
