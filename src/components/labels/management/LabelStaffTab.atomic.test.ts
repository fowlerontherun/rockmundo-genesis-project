import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/production-repairs/20261016_rpc_only_business_asset_write_lock.sql", "utf8");
const labelCutover = readFileSync("supabase/production-repairs/20261016_label_staff_insert_cutover_AFTER_UI_DEPLOY_MANUAL_ONLY.sql", "utf8");
const oldLabelUi = readFileSync("src/components/labels/management/LabelStaffTab.tsx", "utf8");

describe("business asset write lockdown", () => {
  it("revokes unsafe client insertion and updates while leaving deletions untouched", () => {
    expect(sql).toContain("REVOKE INSERT, UPDATE ON TABLE");
    for (const table of [
      "logistics_drivers","merch_factory_workers","logistics_fleet_vehicles",
      "logistics_upgrades","security_firm_upgrades","venue_staff",
      "recording_studio_staff","rehearsal_room_staff","security_guards",
      "recording_studio_equipment","rehearsal_room_equipment","venue_upgrades",
      "recording_studio_upgrades","rehearsal_room_upgrades"
    ]) {
      expect(sql).toContain("public." + table);
    }
    expect(sql).not.toContain("REVOKE DELETE");
  });

  it("keeps the label INSERT lock separate until new UI is deployed", () => {
    expect(sql).toContain("REVOKE UPDATE ON TABLE public.label_staff");
    expect(labelCutover).toContain("REVOKE INSERT ON TABLE public.label_staff");
    expect(labelCutover).toContain("MANUAL ONLY");
  });

  it("moves the legacy label management hire to the server-checked RPC", () => {
    expect(oldLabelUi).toContain('rpc("hire_label_staff_atomic"');
    expect(oldLabelUi).toContain("p_request_id: intent.requestId");
    expect(oldLabelUi).toContain("pendingHires.current.get(role)");
    expect(oldLabelUi).not.toMatch(/\.from\(["']label_staff["']\)\s*\.insert\(/);
    expect(oldLabelUi).not.toMatch(/\.from\(["']labels["']\)\s*\.update\(\{ balance:/);
    expect(oldLabelUi).not.toMatch(/\.from\(["']label_financial_transactions["']\)\.insert\(/);
  });
});
