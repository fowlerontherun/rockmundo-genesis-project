import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261019144000_botb_revoke_unsafe_table_grants.sql",
  "utf8",
);

describe("Battle of the Bands table privileges", () => {
  it("revokes unsafe grants including TRUNCATE from anonymous and players", () => {
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE public.botb_events");
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE public.botb_entries");
    expect(sql.match(/FROM PUBLIC, anon, authenticated;/g)?.length).toBe(2);
    expect(sql).toContain("has_table_privilege('anon','public.botb_events','TRUNCATE')");
    expect(sql).toContain("has_table_privilege('authenticated','public.botb_entries','TRUNCATE')");
    expect(sql).toContain("BOTB_PRIVILEGE_HARDENING_INCOMPLETE");
  });

  it("preserves player read access without granting mutation rights on events", () => {
    expect(sql).toContain("GRANT SELECT ON TABLE public.botb_events TO authenticated");
    expect(sql).not.toContain("GRANT INSERT ON TABLE public.botb_events");
    expect(sql).not.toContain("GRANT UPDATE ON TABLE public.botb_events");
    expect(sql).toContain("has_table_privilege('authenticated','public.botb_events','DELETE')");
    expect(sql).toContain("has_table_privilege('authenticated','public.botb_events','UPDATE')");
  });

  it("keeps temporary legacy withdrawal but blocks direct registration", () => {
    expect(sql).toContain("GRANT SELECT, DELETE ON TABLE public.botb_entries TO authenticated");
    expect(sql).not.toContain("GRANT INSERT ON TABLE public.botb_entries");
    expect(sql).toContain("has_table_privilege('authenticated','public.botb_entries','INSERT')");
    expect(sql).toContain("has_table_privilege('anon','public.botb_entries','DELETE')");
  });

  it("does not break service-role settlement access", () => {
    expect(sql).toContain("has_table_privilege('service_role','public.botb_events','UPDATE')");
    expect(sql).toContain("has_table_privilege('service_role','public.botb_entries','INSERT')");
    expect(sql).not.toContain("REVOKE ALL PRIVILEGES ON TABLE public.botb_events\n  FROM service_role");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("TRUNCATE TABLE public");
  });
});
