// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("hides unsettled award receipts even if another read policy permits them", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE award_shows(id integer PRIMARY KEY, status text);
      CREATE TABLE award_wins(id integer PRIMARY KEY, award_show_id integer);
      ALTER TABLE award_wins ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Wins are viewable by everyone" ON award_wins FOR SELECT USING (true);
      GRANT SELECT ON award_shows, award_wins TO anon, authenticated;
      INSERT INTO award_shows VALUES (1,'live'), (2,'completed');
      INSERT INTO award_wins VALUES (1,1), (2,2);
    `);
    await db.exec(readFileSync("supabase/migrations/20261111154033_gate_published_award_winners.sql", "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      expect((await db.query("SELECT id FROM award_wins ORDER BY id")).rows).toEqual([{ id: 2 }]);
      await db.exec("RESET ROLE");
    }
    await db.exec("UPDATE award_shows SET status='completed' WHERE id=1; SET ROLE authenticated");
    expect((await db.query("SELECT id FROM award_wins ORDER BY id")).rows).toEqual([{ id: 1 }, { id: 2 }]);
  } finally {
    await db.close();
  }
}, 30_000);
