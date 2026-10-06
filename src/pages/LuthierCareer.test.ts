import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("Luthier career discovery", () => {
  it("places Luthier directly beneath Modeling in the Career hub", () => {
    const source = fs.readFileSync("src/pages/hubs/CareerHub.tsx", "utf8");
    expect(source.indexOf('path: "/luthier"')).toBeGreaterThan(source.indexOf('path: "/modeling"'));
    expect(source.indexOf('path: "/luthier"')).toBeLessThan(source.indexOf('path: "/clothing-designer"'));
  });

  it("shows Luthier directly beneath Modeling in the Career sidebar and matches the route to Career", () => {
    const source = fs.readFileSync("src/config/fmNavigation.ts", "utf8");
    const careerStart = source.indexOf('id: "career"');
    const businessStart = source.indexOf('id: "business"');
    const careerSource = source.slice(careerStart, businessStart);
    expect(careerSource).toContain('"/luthier"');
    expect(careerSource.indexOf('{ label: "Luthier", path: "/luthier", icon: Hammer }')).toBeGreaterThan(
      careerSource.indexOf('{ label: "Modeling", path: "/modeling", icon: Sparkles }'),
    );
    expect(careerSource.indexOf('{ label: "Luthier", path: "/luthier", icon: Hammer }')).toBeLessThan(
      careerSource.indexOf('{ label: "Acting", path: "/acting", icon: Film }'),
    );
  });

  it("shows locked state and all four learning routes", () => {
    const source = fs.readFileSync("src/pages/LuthierCareer.tsx", "utf8");
    expect(source).toContain("Luthier career locked");
    expect(source).toContain("Learn Luthiery Basics first");
    for (const route of ["Books", "Mentors", "YouTube", "University"]) expect(source).toContain(route);
  });

  it("seeds every Luthiery tier across every education source", () => {
    const sql = fs.readFileSync("supabase/migrations/20261006082500_luthiery_career_learning_routes.sql", "utf8");
    for (const slug of ["luthiery_basic_technical", "luthiery_professional_technical", "luthiery_mastery_technical"]) expect(sql).toContain(slug);
    for (const table of ["skill_books", "university_courses", "education_youtube_resources", "education_mentors"]) expect(sql).toContain(table);
    expect(sql).toContain("luthiery_learning_source_gaps");
    expect(sql).toContain("CASE tier WHEN 'basic' THEN 3 WHEN 'professional' THEN 4 ELSE 4 END");
  });
});
