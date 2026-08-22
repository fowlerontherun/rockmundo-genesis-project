import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218250000_city_governance_authority.sql",
  "utf8",
);
const projectHook = readFileSync("src/hooks/useCityProjects.ts", "utf8");
const projectUi = readFileSync("src/components/city/MayorProjectsTab.tsx", "utf8");
const electionHook = readFileSync("src/hooks/useCityElections.ts", "utf8");

describe("city project authority", () => {
  it("calculates project cost on the server without a browser override", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.propose_city_project");
    expect(migration).toContain("v_discount := LEAST(15");
    expect(migration).toContain("v_cost := GREATEST(");
    expect(projectHook).toContain('rpc("propose_city_project"');
    expect(projectHook).not.toContain("costOverride");
    expect(projectUi).not.toContain("costOverride");
  });

  it("locks treasury funds and prevents direct authenticated project writes", () => {
    expect(migration).toContain("FROM public.city_treasury\n  WHERE city_id = p_city_id\n  FOR UPDATE");
    expect(migration).toContain("pending_commitments = COALESCE(pending_commitments, 0) + v_cost");
    expect(migration).toContain("REVOKE INSERT, UPDATE ON public.city_projects FROM anon, authenticated");
  });

  it("charges every completed project including weekly-budget upgrades", () => {
    const completion = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.complete_city_project"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.process_due_city_projects"),
    );
    expect(completion).toContain("balance = GREATEST(0, COALESCE(balance, 0) - v_project.cost)");
    expect(completion).toContain("total_spent = COALESCE(total_spent, 0) + v_project.cost");
    expect(completion).toContain("weekly_budget = COALESCE(weekly_budget, 0) + v_weekly_budget");
  });

  it("moves project completion out of the mayor browser", () => {
    expect(migration).toContain("process_due_city_projects");
    expect(migration).toContain("'city-governance-tick'");
    expect(projectUi).not.toContain("processCompletedProjects");
  });
});

describe("city election authority", () => {
  it("validates candidate registration and voting through RPCs", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.register_city_candidate");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.cast_city_election_vote");
    expect(migration).toContain("city_election_fame_required");
    expect(migration).toContain("city_election_residency_required");
    expect(electionHook).toContain('rpc("register_city_candidate"');
    expect(electionHook).toContain('rpc("cast_city_election_vote"');
  });

  it("prevents direct insert bypasses", () => {
    expect(migration).toContain("REVOKE INSERT ON public.city_candidates FROM anon, authenticated");
    expect(migration).toContain("REVOKE INSERT ON public.city_election_votes FROM anon, authenticated");
    expect(electionHook).not.toContain('.from("city_election_votes")\n        .insert');
    expect(electionHook).not.toContain('.from("city_candidates")\n        .insert');
  });

  it("automatically creates, advances and completes annual elections", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.process_city_election_lifecycle");
    expect(migration).toContain("make_timestamptz(v_year, 10, 1");
    expect(migration).toContain("make_timestamptz(v_year, 12, 1");
    expect(migration).toContain("SET status = 'voting'");
    expect(migration).toContain("SET status = 'completed'");
  });

  it("installs the winner as the current mayor for a one-year term", () => {
    const finalizer = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.finalize_city_election_transition"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.process_city_election_lifecycle"),
    );
    expect(finalizer).toContain("NEW.winner_id := v_winner_candidate");
    expect(finalizer).toContain("SET is_current = false");
    expect(finalizer).toContain("INSERT INTO public.city_mayors");
    expect(finalizer).toContain("now() + interval '1 year'");
  });
});

describe("city policy authority", () => {
  it("keeps city laws authoritative over the legacy treasury tax-rate mirror", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.sync_city_treasury_income_tax_rate");
    expect(migration).toContain("tax_rate_pct = ROUND(NEW.income_tax_rate)::integer");
    expect(migration).toContain("UPDATE public.city_treasury t");
  });
});
