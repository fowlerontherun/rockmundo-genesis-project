import { describe, expect, it } from "vitest";
import { getRecruitmentStatusMeta, RECRUITMENT_STATUS } from "./recruitmentStatus";

describe("recruitment status mapping", () => {
  it("labels supported statuses and exposes final/actionable flags", () => {
    expect(RECRUITMENT_STATUS.pending).toMatchObject({ label: "Pending", actionable: true, final: false });
    expect(RECRUITMENT_STATUS.accepted).toMatchObject({ label: "Accepted", actionable: false, final: true });
    expect(RECRUITMENT_STATUS.rejected).toMatchObject({ label: "Rejected", actionable: false, final: true });
    expect(RECRUITMENT_STATUS.withdrawn).toMatchObject({ label: "Withdrawn", actionable: false, final: true });
    expect(RECRUITMENT_STATUS.cancelled).toMatchObject({ label: "Cancelled", actionable: false, final: true });
    expect(RECRUITMENT_STATUS.declined).toMatchObject({ label: "Declined", actionable: false, final: true });
    expect(RECRUITMENT_STATUS.expired).toMatchObject({ label: "Expired", actionable: false, final: true });
  });

  it("uses a safe non-actionable fallback for unsupported statuses", () => {
    expect(getRecruitmentStatusMeta("mystery_state")).toMatchObject({ label: "Mystery State", actionable: false, final: true });
    expect(getRecruitmentStatusMeta(null)).toMatchObject({ label: "Unknown status", actionable: false, final: true });
  });
});
