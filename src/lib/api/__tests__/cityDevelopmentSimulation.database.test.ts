import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const developmentSql = readFileSync(
  "supabase/migrations/20291218252000_city_development_simulation.sql",
  "utf8",
);
const gigDemandSql = readFileSync(
  "supabase/migrations/20291218252100_city_development_gig_demand.sql",
  "utf8",
);
const travelHelper = readFileSync("src/utils/cityDevelopmentTravel.ts", "utf8");
const projectTypes = readFileSync("src/types/city-projects.ts", "utf8");
const cityServices = readFileSync("src/components/city/MayorCityServicesTab.tsx", "utf8");

describe("city development database contract", () => {
  it("creates one bounded development row per city", () => {
    expect(developmentSql).toContain("CREATE TABLE IF NOT EXISTS public.city_development");
    for (const rating of [
      "economy",
      "infrastructure",
      "transport",
      "public_safety",
      "healthcare",
      "culture",
      "music_scene",
      "tourism",
      "quality_of_life",
      "education",
    ]) {
      expect(developmentSql).toContain(`${rating} smallint NOT NULL DEFAULT 50`);
    }
    expect(developmentSql).toContain("CHECK (economy BETWEEN 0 AND 100)");
    expect(developmentSql).toContain("public.clamp_city_rating");
  });

  it("publishes a single bounded gameplay-modifier contract with neutral 50 scores", () => {
    expect(developmentSql).toContain("CREATE OR REPLACE FUNCTION public.city_gameplay_modifiers");
    expect(developmentSql).toContain("economy_revenue_multiplier");
    expect(developmentSql).toContain("audience_demand_multiplier");
    expect(developmentSql).toContain("travel_cost_multiplier");
    expect(developmentSql).toContain("travel_duration_multiplier");
    expect(developmentSql).toContain("incident_risk_multiplier");
    expect(developmentSql).toContain("recovery_multiplier");
    expect(developmentSql).toContain("festival_demand_multiplier");
    expect(developmentSql).toContain("tax_base_multiplier");
    expect(developmentSql).toContain("local_talent_multiplier");
    expect(developmentSql).toContain("0.90 + d.economy * 0.002");
    expect(developmentSql).toContain("1.10 - d.transport * 0.002");
  });

  it("maps every existing mayor project family onto explicit rating effects", () => {
    for (const slug of [
      "build_music_venue",
      "build_concert_hall",
      "upgrade_train_network",
      "music_festival_sponsorship",
      "public_art_program",
      "music_education_grant",
      "tax_office_modernization",
      "tourism_campaign",
      "noise_reduction_initiative",
      "public_safety_boost",
      "healthcare_subsidy",
    ]) {
      expect(developmentSql).toContain(`WHERE slug = '${slug}'`);
    }
    expect(projectTypes).toContain("transport_rating?: number");
    expect(projectTypes).toContain("public_safety_rating?: number");
    expect(projectTypes).toContain("healthcare_rating?: number");
  });

  it("applies development deltas only on an authoritative completed transition and audits before/after state", () => {
    expect(developmentSql).toContain("AFTER UPDATE OF status ON public.city_projects");
    expect(developmentSql).toContain("OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed'");
    expect(developmentSql).toContain("CREATE TABLE IF NOT EXISTS public.city_development_history");
    expect(developmentSql).toContain("before_state");
    expect(developmentSql).toContain("after_state");
    expect(developmentSql).toContain("FOR UPDATE");
  });
});

describe("city development gameplay wiring", () => {
  it("uses culture/music/tourism demand in server-side progressive ticket sales", () => {
    expect(gigDemandSql).toContain("public.city_gameplay_modifiers(v.city_id)");
    expect(gigDemandSql).toContain("m.audience_demand_multiplier");
    expect(gigDemandSql).toContain("COALESCE(v.capacity, 1)");
    expect(gigDemandSql).toContain("CREATE OR REPLACE FUNCTION public.advance_gig_ticket_sales");
  });

  it("uses the average transport quality of both cities for current travel quotes", () => {
    expect(travelHelper).toContain("const averageRating = (fromRating + toRating) / 2");
    expect(travelHelper).toContain("cost: 1.1 - clamped * 0.002");
    expect(travelHelper).toContain("duration: 1.08 - clamped * 0.0016");
    expect(travelHelper).toContain('.from("city_development")');
  });

  it("shows mayors both city ratings and their gameplay modifiers", () => {
    expect(cityServices).toContain("useCityDevelopment");
    expect(cityServices).toContain("useCityGameplayModifiers");
    expect(cityServices).toContain("travel cost modifier");
    expect(cityServices).toContain("live audience demand potential");
    expect(cityServices).toContain("event incident-risk modifier");
    expect(cityServices).toContain("recovery potential");
  });
});
