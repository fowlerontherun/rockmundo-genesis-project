import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const baseSchema = read(
  "supabase/migrations/20250916075501_1adc3330-58fe-4fde-85d0-b13e1e788c85.sql",
);
const compatibilityMigration = read(
  "supabase/migrations/20250916085440_446206dd-4681-4653-9198-bcc512ebdd45.sql",
);
const duplicateMigrations = [
  "supabase/migrations/20250916085517_f5f55449-6b35-4479-93e8-09fa35807472.sql",
  "supabase/migrations/20250916085540_6d17ec9d-9a9c-44be-864d-5972c41adae1.sql",
  "supabase/migrations/20250916085610_b5ae9f69-4eaa-4c54-b70f-6956d77b3f46.sql",
].map(read);
const finalReconciliation = read(
  "supabase/migrations/20291218243000_reconcile_auth_signup_trigger.sql",
);

describe("auth signup trigger migration authority", () => {
  it("confirms the base schema owns the original trigger", () => {
    expect(baseSchema).toContain("CREATE TRIGGER on_auth_user_created");
    expect(baseSchema).toContain("EXECUTE FUNCTION public.handle_new_user()");
  });

  it("makes the compatibility trigger creation conditional", () => {
    expect(compatibilityMigration).toContain("FROM pg_trigger");
    expect(compatibilityMigration).toContain("tgname = 'on_auth_user_created'");
    expect(compatibilityMigration).toContain("IF NOT EXISTS");
    expect(compatibilityMigration).toContain("CREATE TRIGGER on_auth_user_created");
  });

  it("adds only missing baseline catalogue rows", () => {
    expect(compatibilityMigration).toContain("FROM public.achievements existing");
    expect(compatibilityMigration).toContain("FROM public.equipment_items existing");
    expect(compatibilityMigration).toContain("FROM public.venues existing");
    expect(compatibilityMigration).toContain("FROM public.streaming_platforms existing");
    expect(compatibilityMigration.match(/WHERE NOT EXISTS/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps every accidental duplicate seed timestamp as a no-op", () => {
    for (const duplicateMigration of duplicateMigrations) {
      expect(duplicateMigration.toLowerCase()).toContain("duplicate");
      expect(duplicateMigration).not.toContain("CREATE TRIGGER on_auth_user_created");
      expect(duplicateMigration).not.toContain("INSERT INTO public.achievements");
      expect(duplicateMigration).not.toContain("INSERT INTO public.equipment_items");
      expect(duplicateMigration).not.toContain("ON CONFLICT (name)");
    }
  });

  it("rebinds exactly one final trigger to the latest function", () => {
    expect(finalReconciliation).toContain(
      "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users",
    );
    expect(finalReconciliation).toContain("CREATE TRIGGER on_auth_user_created");
    expect(finalReconciliation).toContain("EXECUTE FUNCTION public.handle_new_user()");
    expect(finalReconciliation).toContain("to_regprocedure('public.handle_new_user()')");
  });
});