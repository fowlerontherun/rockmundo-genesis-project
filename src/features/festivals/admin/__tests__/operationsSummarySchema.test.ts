import { describe, expect, it } from "vitest";
import { operationsSummarySchema } from "../service";

const requiredSlot = {
  id: "slot-1",
  stage_id: "stage-1",
  day_number: 1,
  start_time: "2027-06-01T18:00:00Z",
  end_time: "2027-06-01T18:45:00Z",
  slot_type: "opener",
  status: "open",
  public_status: "draft",
  slot_number: 1,
  changeover_minutes: 30,
  changeover_duration_minutes: 30,
  system_act_id: null,
  system_act_name: null,
  system_act_status: null,
  contract_status: null,
};

describe("operationsSummarySchema", () => {
  it("requires the slot contract fields used by dashboard and schedule consumers", () => {
    const parsed = operationsSummarySchema.parse({
      stages: [],
      slots: [requiredSlot],
      staff: [],
      permit_requirements: [],
      insurance_policies: [],
      schedule_summary: {
        total_slots: 1,
        occupied_slots: 0,
        open_slots: 1,
        contracted_acts: 0,
        published_acts: 0,
        system_acts: 0,
      },
      permissions: { can_manage: true, finance_access: false, full_access: false },
      lifecycle: { status: "draft", start_at: null, end_at: null, currency_code: "GBP" },
    });

    expect(parsed.slots[0]).toMatchObject({
      status: "open",
      public_status: "draft",
      slot_number: 1,
      changeover_minutes: 30,
    });
  });

  it("rejects slot regressions that remove required operational state", () => {
    const { status: _status, public_status: _publicStatus, ...missingState } = requiredSlot;

    expect(() => operationsSummarySchema.parse({ slots: [missingState] })).toThrow();
  });
});
