import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const path = "supabase/migrations/20250919064642_create_skills_table.sql";

test("legacy skills migration is executable SQL with a complete parent-safe seed", () => {
  const sql = readFileSync(path, "utf8");
  assert.doesNotMatch(sql, /^\s*\\(?:i|include|copy)\b/m,
    "Supabase SQL migration runner cannot interpret psql backslash commands");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.skills/);
  assert.match(sql, /ON CONFLICT \(skill_id\) DO UPDATE/);

  const insertStart = sql.indexOf("INSERT INTO public.skills");
  const insertEnd = sql.indexOf("ON CONFLICT (skill_id)");
  assert.ok(insertStart >= 0 && insertEnd > insertStart);
  const input = sql.slice(insertStart, insertEnd);
  const rows = [...input.matchAll(/^\s*\('([^']+)',/gm)].map((match) => match[1]);
  assert.equal(rows.length, 168, "migration must include the frozen 168 skill definitions");
  assert.equal(new Set(rows).size, rows.length, "duplicate skill rows");

  const parentSection = sql.slice(sql.indexOf("UPDATE public.skills AS s"));
  const links = [...parentSection.matchAll(/^\s*\('([^']+)', (NULL|'[^']+')\),?$/gm)]
    .map((match) => [match[1], match[2] === "NULL" ? null : match[2].slice(1, -1)]);
  assert.equal(links.length, rows.length, "all rows must receive canonical parent mapping");
  assert.deepEqual(new Set(links.map(([id]) => id)), new Set(rows));
  const known = new Set(rows);
  for (const [id, parent] of links) {
    assert.ok(!parent || known.has(parent), `Missing parent ${parent} for ${id}`);
    assert.notEqual(parent, id, "a skill cannot reference itself as a parent");
  }
  assert.match(sql, /UPDATE public\.skills AS s[\s\S]*SET skill_parent_id/);
});
