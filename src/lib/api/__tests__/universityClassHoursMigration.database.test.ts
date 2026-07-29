import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const prematureMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251001120000_add_class_hours_to_university_courses.sql",
  ),
  "utf8",
);
const universityMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251007090213_b9318898-e8af-43af-8eb9-f208cb95542b.sql",
  ),
  "utf8",
);
const forwardMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243450_reconcile_university_class_hours.sql",
  ),
  "utf8",
);

describe("university class hour migration ordering", () => {
  it("does not alter university courses before the table exists", () => {
    expect(prematureMigration).toContain("Historical ordering marker");
    expect(prematureMigration).not.toContain(
      "alter table public.university_courses",
    );
  });

  it("creates class hours with the course table", () => {
    expect(universityMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.university_courses",
    );
    expect(universityMigration).toContain(
      "class_start_hour INTEGER NOT NULL DEFAULT 10",
    );
    expect(universityMigration).toContain(
      "class_end_hour INTEGER NOT NULL DEFAULT 14",
    );
    expect(universityMigration).toContain(
      "CONSTRAINT university_courses_class_hours_check CHECK",
    );
  });

  it("guards enrollment schema and named objects for replay", () => {
    expect(universityMigration).toContain(
      "CREATE TYPE public.enrollment_status AS ENUM",
    );
    expect(universityMigration).toContain("WHEN duplicate_object THEN NULL");
    expect(universityMigration).toContain(
      'DROP POLICY IF EXISTS "Courses are viewable by everyone"',
    );
    expect(universityMigration).toContain(
      "DROP TRIGGER IF EXISTS update_university_courses_updated_at",
    );
  });

  it("restores existing databases without rewriting courses", () => {
    expect(forwardMigration).toContain(
      "ADD COLUMN IF NOT EXISTS class_start_hour",
    );
    expect(forwardMigration).toContain(
      "ADD COLUMN IF NOT EXISTS class_end_hour",
    );
    expect(forwardMigration).toContain("NOT VALID");
    expect(forwardMigration).not.toContain("UPDATE public.university_courses");
    expect(forwardMigration).not.toContain("DELETE FROM public.university_courses");
  });
});
