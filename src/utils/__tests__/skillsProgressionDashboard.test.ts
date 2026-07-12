import { describe, expect, it } from "vitest";
import { CANONICAL_ATTRIBUTE_LINKS, CANONICAL_PREREQUISITES, CANONICAL_ROLE_LINKS, CANONICAL_SKILLS, CANONICAL_SYSTEM_LINKS, CANONICAL_UNLOCK_ROUTES } from "../skillCatalogue";
import { buildRecommendations, buildSkillDashboardRows, filterAndSortSkillRows, summarizeRoleReadiness } from "../skillsProgressionDashboard";

const rows = () => buildSkillDashboardRows({
  catalogue: CANONICAL_SKILLS,
  progress: [
    { skill_slug: "guitar", current_level: 3, xp_into_level: 90, xp_required_for_next_level: 100, is_unlocked: true },
    { skill_slug: "vocals", current_level: 1, xp_into_level: 10, xp_required_for_next_level: 100, is_unlocked: true },
    { skill_slug: "performance", current_level: 0, xp_into_level: 0, xp_required_for_next_level: 100, is_unlocked: false },
  ],
  availability: [
    { slug: "guitar", status: "unlocked" },
    { slug: "vocals", status: "unlocked" },
    { slug: "performance", status: "available_to_unlock" },
    { slug: "hidden_test", status: "hidden" },
  ],
  roleLinks: CANONICAL_ROLE_LINKS,
  systemLinks: CANONICAL_SYSTEM_LINKS,
  attributeLinks: CANONICAL_ATTRIBUTE_LINKS,
  prerequisites: CANONICAL_PREREQUISITES,
  unlockRoutes: CANONICAL_UNLOCK_ROUTES,
  favourites: ["guitar"],
  selectedRole: "lead_guitarist",
});

describe("skills progression dashboard", () => {
  it("builds role readiness from canonical mappings and exposes gaps", () => {
    const readiness = summarizeRoleReadiness("lead_guitarist", rows());
    expect(readiness.role).toBe("lead_guitarist");
    expect(readiness.band).toMatch(/Beginner|Developing|Competent|Strong|Advanced|Elite/);
    expect(readiness.gaps.some((gap) => gap.roleLinks.some((link) => link.role_key === "lead_guitarist"))).toBe(true);
  });

  it("filters text, role, state and favourites together", () => {
    const filtered = filterAndSortSkillRows(rows(), { search: "guitar", role: "lead_guitarist", lock: "favourite", sort: "alphabetical" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].catalogue.slug).toBe("guitar");
  });

  it("prioritises nearly completed relevant skills deterministically", () => {
    const recs = buildRecommendations(rows(), "lead_guitarist", 3);
    expect(recs[0].title).toContain("Guitar");
    expect(recs[0].reason).toContain("Estimated contributions");
    expect(recs.map((r) => r.id)).toEqual(buildRecommendations(rows(), "lead_guitarist", 3).map((r) => r.id));
  });

  it("excludes inactive and hidden catalogue rows", () => {
    const built = rows();
    expect(built.every((row) => row.catalogue.is_active && !row.catalogue.is_hidden)).toBe(true);
  });
});
