import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const roleMigration = read(
  "supabase/migrations/20250916092537_a7a97757-8b10-4046-b558-dd22f45d296c.sql",
);
const duplicateRoleMigration = read(
  "supabase/migrations/20250916092648_ab238d3f-a45d-4b44-a477-803eaa1cdd54.sql",
);
const safetyMigration = read(
  "supabase/migrations/20291218243100_neutralise_insecure_default_admin.sql",
);

describe("default administrator provisioning security", () => {
  it("preserves the role model and normal signup role", () => {
    expect(roleMigration).toContain("CREATE TYPE public.app_role");
    expect(roleMigration).toContain("CREATE TABLE public.user_roles");
    expect(roleMigration).toContain("CREATE OR REPLACE FUNCTION public.handle_new_user()");
    expect(roleMigration).toContain("VALUES (NEW.id, 'user')");
  });

  it("does not create a known administrator credential", () => {
    expect(roleMigration).not.toContain("INSERT INTO auth.users");
    expect(roleMigration).not.toContain("encrypted_password");
    expect(roleMigration).not.toContain("admin@rockmundo.com");
    expect(roleMigration).toContain("Default admin account seed intentionally disabled");
  });

  it("retires the duplicate role schema timestamp", () => {
    expect(duplicateRoleMigration).toContain("Duplicate role schema migration intentionally skipped");
    expect(duplicateRoleMigration).not.toContain("CREATE TYPE public.app_role");
    expect(duplicateRoleMigration).not.toContain("CREATE TABLE public.user_roles");
    expect(duplicateRoleMigration).not.toContain("CREATE POLICY");
    expect(duplicateRoleMigration).not.toContain("CREATE OR REPLACE FUNCTION public.handle_new_user()");
  });

  it("neutralises only the recognisable legacy seeded account", () => {
    expect(safetyMigration).toContain("lower(users.email) = 'admin@rockmundo.com'");
    expect(safetyMigration).toContain("raw_user_meta_data->>'username'");
    expect(safetyMigration).toContain("raw_user_meta_data->>'display_name'");
    expect(safetyMigration).toContain("banned_until = 'infinity'::timestamptz");
    expect(safetyMigration).toContain("seeded_default_admin_disabled");
  });

  it("revokes administrator authority without deleting game data", () => {
    expect(safetyMigration).toContain("DELETE FROM public.user_roles");
    expect(safetyMigration).toContain("role = 'admin'::public.app_role");
    expect(safetyMigration).toContain("VALUES (v_seeded_admin_id, 'user'::public.app_role)");
    expect(safetyMigration).not.toContain("DELETE FROM auth.users");
    expect(safetyMigration).not.toContain("DELETE FROM public.profiles");
  });
});