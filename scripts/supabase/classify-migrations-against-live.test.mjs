import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint, classify } from "./classify-migrations-against-live.mjs";

const live = {
  tables: new Set(["bands"]),
  views: new Set(),
  functions: new Set(["fund_my_band"]),
  triggers: new Set(),
  policies: new Set(["bands|Bands are viewable"]),
};
const none = { tables: new Set(), views: new Set(), functions: new Set() };

test("all created objects present is applied", () => {
  const fp = fingerprint(`CREATE TABLE IF NOT EXISTS public.bands(id uuid);
    CREATE POLICY "Bands are viewable" ON public.bands FOR SELECT USING (true);
    CREATE OR REPLACE FUNCTION public.fund_my_band() RETURNS void AS $$ $$ LANGUAGE sql;`);
  assert.equal(classify(fp, live, none).status, "applied");
});

test("some present is partial, none present is missing", () => {
  assert.equal(classify(fingerprint("create table bands(); create table band_proposals();"), live, none).status, "partial");
  assert.equal(classify(fingerprint("create table band_proposals();"), live, none).status, "missing");
});

test("objects dropped by a later migration are not expected", () => {
  const fp = fingerprint("create table old_thing();");
  assert.equal(classify(fp, live, { ...none, tables: new Set(["old_thing"]) }).status, "unverifiable");
});

test("commented-out statements are ignored", () => {
  assert.equal(classify(fingerprint("-- create table ghost();"), live, none).status, "unverifiable");
});
