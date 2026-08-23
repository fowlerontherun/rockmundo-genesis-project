import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const historicalPermitSql = read(
  "supabase/migrations/20291218252000_city_festival_permit_authority.sql",
);
const simplifiedPermitSql = read(
  "supabase/migrations/20291218252200_simplify_festival_permits_to_automatic_simulation.sql",
);
const reconciliationSql = read(
  "supabase/reconciliation/festival/20260823_simplify_festival_permits_to_automatic_simulation.sql",
);

describe("simplified Festival permit authority", () => {
  it("retires the historical owner/mayor permit approval workflow", () => {
    expect(historicalPermitSql).toContain("apply_for_festival_city_permit");
    expect(historicalPermitSql).toContain("get_city_festival_permit_queue");
    expect(historicalPermitSql).toContain("decide_city_festival_permit");

    expect(simplifiedPermitSql).toContain(
      "DROP FUNCTION IF EXISTS public.apply_for_festival_city_permit_for_edition(uuid, uuid, text)",
    );
    expect(simplifiedPermitSql).toContain(
      "DROP FUNCTION IF EXISTS public.get_city_festival_permit_queue(uuid)",
    );
    expect(simplifiedPermitSql).toContain(
      "DROP FUNCTION IF EXISTS public.decide_city_festival_permit(uuid, text, text, uuid)",
    );
  });

  it("removes the launch-time mayor approval gate but preserves the city-law input", () => {
    expect(historicalPermitSql).toContain("enforce_city_festival_permit_before_launch");
    expect(historicalPermitSql).toContain("festival_permit_required");

    expect(simplifiedPermitSql).toContain(
      "DROP TRIGGER IF EXISTS enforce_city_festival_permit_before_launch ON public.festival_launches",
    );
    expect(simplifiedPermitSql).toContain(
      "DROP FUNCTION IF EXISTS public.enforce_city_festival_permit_on_launch()",
    );
    expect(simplifiedPermitSql).toContain("Keep public._festival_city_law_for_edition(uuid)");
  });

  it("keeps compatibility permit rows private if the old table exists", () => {
    expect(simplifiedPermitSql).toContain(
      "REVOKE ALL ON TABLE public.city_festival_permits FROM PUBLIC, anon, authenticated",
    );
    expect(simplifiedPermitSql).toContain(
      "GRANT ALL ON TABLE public.city_festival_permits TO service_role",
    );
    expect(reconciliationSql).toContain(
      "DROP FUNCTION IF EXISTS public.apply_for_festival_city_permit_for_edition(uuid, uuid, text)",
    );
    expect(reconciliationSql).toContain(
      "REVOKE ALL ON TABLE public.city_festival_permits FROM PUBLIC, anon, authenticated",
    );
  });
});
