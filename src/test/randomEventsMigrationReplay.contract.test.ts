import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const migration = (name: string) => readFileSync(
 resolve(process.cwd(),"supabase/migrations",name),"utf8"
);
const legacy = migration("20250925211726_create_world_environment_tables.sql");
const modern = migration("20251217172234_d28ed50d-608d-4248-a6ce-0b63a10ff95d.sql");

describe("legacy random events replay", () => {
 it("preserves existing timed world event content", () => {
  expect(legacy).toContain("CREATE TABLE IF NOT EXISTS public.random_events");
  expect(legacy).toContain("expiry timestamptz NOT NULL");
  expect(modern).toContain("CREATE TABLE IF NOT EXISTS public.random_events");
  expect(modern).toContain("ALTER COLUMN expiry DROP NOT NULL");
  expect(modern).not.toContain("DROP TABLE public.random_events");
  expect(modern).not.toContain("TRUNCATE public.random_events");
 });
 it("adds newer choice columns without rewriting old event narratives", () => {
  expect(modern).toContain("ADD COLUMN IF NOT EXISTS option_a_text text");
  expect(modern).toContain("ADD COLUMN IF NOT EXISTS option_b_text text");
  expect(modern).toContain("ADD COLUMN IF NOT EXISTS option_a_effects jsonb");
  expect(modern).toContain("ADD COLUMN IF NOT EXISTS is_active boolean");
  expect(modern).not.toContain("UPDATE public.random_events SET option_a_text");
 });
 it("retains the original updated_at trigger without duplicates", () => {
  expect(legacy).toContain("CREATE TRIGGER update_random_events_updated_at");
  expect(modern).toContain("tgname='update_random_events_updated_at'");
  expect(modern).toContain('DROP POLICY IF EXISTS "Random events are viewable by everyone"');
 });
 it("creates the modern player event and history tables", () => {
  expect(modern).toContain("CREATE TABLE IF NOT EXISTS public.player_events");
  expect(modern).toContain("CREATE TABLE IF NOT EXISTS public.player_event_history");
 });
});
