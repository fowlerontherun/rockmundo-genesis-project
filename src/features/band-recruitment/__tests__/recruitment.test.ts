import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { applyToVacancy, buildVacancyPayload, sanitizeRecruitmentText, validateVacancyDraft, type BandVacancy } from "../services/recruitment";

const vacancy: BandVacancy = {
  id: "11111111-1111-4111-8111-111111111111",
  band_id: "22222222-2222-4222-8222-222222222222",
  title: "Lead Guitarist",
  description: "Join us",
  status: "open",
  visibility: "public",
  role_type: "member",
  instrument: "Electric Guitar",
  genres: ["rock"],
  commitment_level: "regular",
  positions_available: 1,
  positions_filled: 0,
  audition_required: false,
  remote_or_travel_allowed: true,
  direct_applications_allowed: true,
};

beforeEach(() => vi.clearAllMocks());

describe("band recruitment service helpers", () => {
  it("sanitises executable html from vacancy copy", () => {
    expect(sanitizeRecruitmentText(" <script>alert(1)</script> Drummer ")).toBe("alert(1) Drummer");
  });

  it("validates required vacancy fields and question limits", () => {
    const errors = validateVacancyDraft({ title: "DJ", application_questions: new Array(9).fill({ type: "short_text" }) });
    expect(errors.title).toBeTruthy();
    expect(errors.application_questions).toBeTruthy();
  });

  it("builds stable safe payloads for draft or publish RPCs", () => {
    expect(buildVacancyPayload({ title: " <b>Lead Guitar</b> ", description: "No drama", genres: ["rock"] })).toMatchObject({ title: "Lead Guitar", genres: ["rock"] });
  });

  it("submits vacancy applications through the guarded RPC", async () => {
    const application = { id: "application-1", status: "pending" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: application, error: null } as never);

    await expect(applyToVacancy(vacancy, "active-profile", " <b>Ready</b> to rehearse ")).resolves.toBe(application);
    expect(supabase.rpc).toHaveBeenCalledWith("submit_band_vacancy_application", {
      target_vacancy_id: vacancy.id,
      cover: "Ready to rehearse",
      answers: {},
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("does not bypass a vacancy that has disabled direct applications", async () => {
    await expect(applyToVacancy({ ...vacancy, direct_applications_allowed: false }, "active-profile", "Ready"))
      .rejects.toThrow("not accepting direct applications");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
