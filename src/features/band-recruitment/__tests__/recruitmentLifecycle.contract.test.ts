import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20300106170000_repair_band_recruitment_capacity_applications_expiry.sql"), "utf8");
const source = readFileSync(resolve(process.cwd(), "src/features/band-recruitment/services/recruitment.ts"), "utf8");

function rpcSection(name: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf("$$;", start) + 3);
}

describe("band recruitment lifecycle regression contracts", () => {
  it("enforces vacant membership capacity on publish and resume, under a lock", () => {
    const capacity = rpcSection("guard_band_vacancy_capacity");
    expect(capacity).toContain("WHERE b.id=NEW.band_id FOR UPDATE");
    expect(capacity).toContain("NOT COALESCE(bm.is_touring_member,false)");
    expect(capacity).toContain("GREATEST(v.positions_available-v.positions_filled,0)");
    expect(capacity).toContain("GREATEST(NEW.positions_available-NEW.positions_filled,0) > v_capacity");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF band_id, status, positions_available, positions_filled, application_deadline");
  });

  it("creates advertisements as the selected active profile, not oldest account character", () => {
    const create = rpcSection("create_band_vacancy");
    expect(create).toContain("public.current_profile_id()");
    expect(create).not.toContain("ORDER BY created_at LIMIT 1");
  });

  it("does not reuse pending applications from different vacancies", () => {
    const submit = rpcSection("submit_band_vacancy_application");
    expect(submit).toContain("WHERE vacancy_id=v_vacancy.id");
    expect(submit).not.toContain("WHERE band_id=v_vacancy.band_id\n    AND applicant_profile_id");
    expect(migration).toContain("DROP INDEX IF EXISTS public.band_applications_one_pending_per_band_idx");
    expect(migration).toContain("band_applications_one_pending_per_vacancy");
  });

  it("does not rollback the expiry state of overdue vacancies and offers", () => {
    const submit = rpcSection("submit_band_vacancy_application");
    const accept = rpcSection("accept_band_offer");
    expect(submit).toMatch(/SET status='expired',[\s\S]*?RETURN NULL/);
    expect(accept).toMatch(/SET status='expired',[\s\S]*?RETURN NULL/);
    expect(accept).not.toContain("ORDER BY created_at LIMIT 1");
    expect(accept).toContain("public.current_profile_id()");
    const sweep = rpcSection("expire_band_recruitment_records");
    expect(sweep).toContain("UPDATE public.band_vacancies");
    expect(sweep).toContain("UPDATE public.band_membership_offers");
    expect(migration).toContain("*/15 * * * *");
  });

  it("does not show time-expired or filled adverts in public search", () => {
    expect(source).toContain("isVacancyApplyable(vacancy, now)");
    expect(source).toContain("application_deadline.gt.");
    expect(source).toContain('vacancy.positions_filled >= vacancy.positions_available');
    expect(source).toContain('eligible.slice(offsetWanted, offsetWanted + size)');
  });
});
