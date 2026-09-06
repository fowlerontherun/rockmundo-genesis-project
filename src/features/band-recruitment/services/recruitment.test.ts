import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyToVacancy,
  buildVacancyPayload,
  createBandVacancy,
  deleteBandVacancy,
  updateBandVacancyStatus,
  type BandVacancy,
} from "./recruitment";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

const vacancy: BandVacancy = {
  id: "11111111-1111-4111-8111-111111111111",
  band_id: "22222222-2222-4222-8222-222222222222",
  title: "Lead guitarist wanted",
  description: "Join us",
  status: "open",
  visibility: "public",
  role_type: "member",
  instrument: "Electric Guitar",
  genres: [],
  commitment_level: "regular",
  positions_available: 1,
  positions_filled: 0,
  audition_required: false,
  remote_or_travel_allowed: true,
  direct_applications_allowed: true,
  application_questions: [{ type: "text", prompt: "Can you rehearse weekly?", required: true }],
};

describe("band recruitment service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sanitizes and retains structured application questions", () => {
    const payload = buildVacancyPayload({
      title: " <b>Guitarist</b> ",
      instrument: " Electric Guitar ",
      application_questions: [{ type: "text", prompt: " <i>Why us?</i> ", required: true }],
    });

    expect(payload.title).toBe("Guitarist");
    expect(payload.instrument).toBe("Electric Guitar");
    expect(payload.application_questions).toEqual([{ type: "text", prompt: "Why us?", required: true }]);
  });

  it("creates adverts through the guarded RPC rather than direct table inserts", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: vacancy, error: null } as never);

    await expect(createBandVacancy(vacancy.band_id, "profile-id", vacancy, true)).resolves.toBe(vacancy);
    expect(supabase.rpc).toHaveBeenCalledWith("create_band_vacancy", expect.objectContaining({
      target_band_id: vacancy.band_id,
      publish: true,
      vacancy_payload: expect.objectContaining({ instrument: "Electric Guitar" }),
    }));
  });

  it("updates and deletes adverts through guarded lifecycle RPCs", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: { ...vacancy, status: "closed" }, error: null } as never)
      .mockResolvedValueOnce({ data: true, error: null } as never);

    await updateBandVacancyStatus(vacancy.id, "closed");
    await expect(deleteBandVacancy(vacancy.id)).resolves.toBe(true);

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "update_band_vacancy_status", {
      target_vacancy_id: vacancy.id,
      next_status: "closed",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "delete_band_vacancy", {
      target_vacancy_id: vacancy.id,
    });
  });

  it("requires answers to required advert questions before submitting", async () => {
    await expect(applyToVacancy(vacancy, "profile-id", "I'd like to join", {})).rejects.toThrow("required application questions");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("submits application message and answers to the vacancy RPC", async () => {
    const application = { id: "33333333-3333-4333-8333-333333333333", status: "pending" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: application, error: null } as never);

    await expect(applyToVacancy(vacancy, "profile-id", " <b>I'd like to join</b> ", {
      "Can you rehearse weekly?": " Yes ",
    })).resolves.toBe(application);

    expect(supabase.rpc).toHaveBeenCalledWith("submit_band_vacancy_application", {
      target_vacancy_id: vacancy.id,
      cover: "I'd like to join",
      answers: { "Can you rehearse weekly?": "Yes" },
    });
  });
});
