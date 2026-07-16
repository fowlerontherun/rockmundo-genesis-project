import fs from "node:fs";
import path from "node:path";
const dir = path.join(process.cwd(), "supabase/migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const foundation = "20291204090000_create_festival_editions.sql";
const hardening = "20291205090000_harden_festival_editions.sql";
const notes = fs.readFileSync(
  path.join(process.cwd(), "docs/festivals/EDITION_MIGRATION_NOTES.md"),
  "utf8",
);
if (!files.includes(foundation))
  throw new Error(`Missing historical migration ${foundation}`);
if (!files.includes(hardening))
  throw new Error(`Missing hardening migration ${hardening}`);
const hardeningSql = fs.readFileSync(path.join(dir, hardening), "utf8");
const fnAt = hardeningSql.indexOf(
  "CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status",
);
const viewAt = hardeningSql.indexOf(
  "CREATE VIEW public.public_festival_editions",
);
if (fnAt < 0 || viewAt < 0 || fnAt > viewAt)
  throw new Error(
    "public status helper must be created before the dependent public view",
  );
if (!notes.includes("20291204090000") || !notes.includes("historical"))
  throw new Error("Migration notes must document the historical 2029 anomaly");
const suspicious = files.filter(
  (f) =>
    /festival/i.test(f) &&
    f < foundation &&
    fs.readFileSync(path.join(dir, f), "utf8").includes("festival_editions"),
);
if (suspicious.length)
  throw new Error(
    `Festival edition-dependent migrations before foundation: ${suspicious.join(", ")}`,
  );
console.log("Festival edition migration ordering checks passed");
