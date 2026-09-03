import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260903173724_rebalance_universities_and_courses.sql",
  ),
  "utf8",
);

const indexMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260903195123_index_university_courses_university_id.sql",
  ),
  "utf8",
);

describe("university and course rebalance migration", () => {
  it("re-rates every institution on separate quality and prestige scales", () => {
    expect(migration).toContain("UPDATE public.universities AS university");
    expect(migration).toContain("prestige = new_ratings.prestige");
    expect(migration).toContain("quality_of_learning = new_ratings.quality_of_learning");
    expect(migration).toContain("course_cost_modifier = CASE");
  });

  it("uses stable catalogue keys instead of generated ids for variation", () => {
    expect(migration).toContain(
      "university.name || '|' || course.skill_slug || '|' || course.name || '|price-v2'",
    );
    expect(migration).not.toContain("course.id || '|price-v2'");
    expect(migration).not.toContain("university.id || '|price-v2'");
  });

  it("balances price, duration, and XP without replacing course rows", () => {
    expect(migration).toContain("UPDATE public.university_courses AS course");
    expect(migration).toContain("base_price = new_course_balance.base_price");
    expect(migration).toContain("base_duration_days = new_course_balance.base_duration_days");
    expect(migration).toContain("xp_per_day_min = new_course_balance.xp_per_day_min");
    expect(migration).toContain("xp_per_day_max = new_course_balance.xp_per_day_max");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.university_courses/i);
  });

  it("keeps future rating changes connected to course XP", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.rebalance_university_course_xp_on_rating_change()",
    );
    expect(migration).toContain("AFTER INSERT OR UPDATE OF prestige, quality_of_learning");
    expect(migration).toContain("SET search_path TO ''");
  });

  it("does not rewrite historical enrollment snapshots", () => {
    expect(migration).not.toMatch(/UPDATE\s+public\.player_university_enrollments/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.player_university_enrollments/i);
  });

  it("indexes the university lookup used by the rating trigger", () => {
    expect(indexMigration).toContain(
      "CREATE INDEX IF NOT EXISTS university_courses_university_id_idx",
    );
    expect(indexMigration).toContain(
      "ON public.university_courses (university_id)",
    );
  });
});
