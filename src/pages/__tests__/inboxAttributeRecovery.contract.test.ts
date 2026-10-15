import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
describe("inbox and attribute spend production recovery", () => {
  it("supports every UI attribute and the 1000-point cap", () => {
    const sql = read("supabase/production-repairs/20261015_restore_attribute_spending.sql");
    const source = read("src/utils/attributeProgression.ts");
    const keys = source.split("export const FULL_ATTRIBUTE_KEYS: FullAttributeKey[] = [")[1]?.split("];")[0] ?? "";
    const attributes = [...keys.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    expect(attributes).toHaveLength(13);
    for (const key of attributes) expect(sql).toContain("'" + key + "'");
    expect(sql).toContain("v_value + p_cost > 1000");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("p.user_id = auth.uid()");
    expect(sql).toContain("TO authenticated");
  });
  it("restores notification states with owner-only reads", () => {
    const sql = read("supabase/production-repairs/20261015_notification_profile_states_restore.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.notification_profile_states");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.set_notification_profile_states");
    expect(sql).toContain("GRANT SELECT ON public.notification_profile_states TO authenticated");
  });
  it("shows partial inbox while preserving detailed spend errors", () => {
    expect(read("src/utils/progression.ts")).toContain('getFunctionErrorMessage(error, "Failed to spend attribute points")');
    expect(read("src/hooks/useUnifiedInbox.ts")).toContain("partialError:");
    expect(read("src/pages/Inbox.tsx")).toContain("Some inbox updates could not be loaded");
  });
});
