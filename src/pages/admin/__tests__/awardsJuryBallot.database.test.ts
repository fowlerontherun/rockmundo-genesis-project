// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("records one private, server-weighted jury ballot per admin and category", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS
        'SELECT $1 = ''${id(1)}'' AND $2 = ''admin''';
      CREATE TABLE award_shows(id uuid PRIMARY KEY, status text, ceremony_date timestamptz, categories jsonb);
      CREATE TABLE award_nominations(id uuid PRIMARY KEY, award_show_id uuid, category_name text, status text);
      CREATE TABLE award_votes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nomination_id uuid,
        voter_type text, voter_id uuid, voter_account_id uuid, weight integer);
      INSERT INTO award_shows VALUES ('${id(2)}','voting_open',now()+interval '1 day',
        '[{"name":"Best Band","juryWeight":4},{"name":"Best Live Band"}]');
      INSERT INTO award_nominations VALUES
        ('${id(3)}','${id(2)}','Best Band','shortlisted'),
        ('${id(4)}','${id(2)}','Best Band','shortlisted'),
        ('${id(5)}','${id(2)}','Best Live Band','shortlisted'),
        ('${id(6)}','${id(2)}','Best Band','pending');
    `);
    await db.exec(readFileSync("supabase/migrations/20261111153717_award_configured_jury_ballots.sql", "utf8"));
    const vote = (n: number) => db.query<{ ballot: string }>(
      "SELECT public.cast_award_jury_ballot($1,$2) AS ballot", [id(2), id(n)],
    );
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(7)]);
    await db.exec("SET ROLE authenticated");
    await expect(vote(3)).rejects.toThrow("Only award administrators");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(1)]);
    await expect(vote(5)).rejects.toThrow("disabled for this category");
    await expect(vote(6)).rejects.toThrow("shortlisted nomination");
    const first = (await vote(3)).rows[0].ballot;
    expect((await vote(3)).rows[0].ballot).toEqual(first);
    await expect(vote(4)).rejects.toThrow("already cast");
    await expect(db.query("SELECT * FROM award_jury_ballot_receipts")).rejects.toThrow("permission denied");

    await db.exec("RESET ROLE");
    expect((await db.query("SELECT id,weight,voter_type,voter_account_id,voter_id FROM award_votes")).rows)
      .toEqual([{ id: first, weight: 4, voter_type: "jury", voter_account_id: null, voter_id: expect.not.stringMatching(id(1)) }]);
    await db.exec(`UPDATE award_shows SET status='live', categories='[{"name":"Best Live Band","juryWeight":4}]'`);
    await db.exec("SET ROLE authenticated");
    await expect(vote(5)).rejects.toThrow("open voting");
  } finally {
    await db.close();
  }
}, 30_000);
