import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

import {
  fetchFestivalScheduleWorkspace,
  upsertScheduleItem,
} from "./service";

const canonicalEditionId = "11111111-1111-4111-8111-111111111111";
const scheduleEditionId = "22222222-2222-4222-8222-222222222222";

const bridgeResult = {
  festivalCompanyId: "33333333-3333-4333-8333-333333333333",
  festivalEditionId: canonicalEditionId,
  scheduleFestivalId: "44444444-4444-4444-8444-444444444444",
  scheduleEditionId,
  timeZone: "Europe/London",
  created: false,
};

const workspaceResult = {
  festival: { id: bridgeResult.scheduleFestivalId },
  edition: { id: scheduleEditionId },
  timeZone: "Europe/London",
  festivalDates: ["2030-06-01"],
  scheduleState: "draft",
  draftRevision: { id: "55555555-5555-4555-8555-555555555555" },
  publishedRevision: null,
  revisionHistory: [],
  stages: [],
  operatingHours: [],
  scheduleItems: [],
  unscheduledItems: [],
  conflictSummary: {},
  readinessSummary: {},
  permissions: {},
  availableActions: [],
};

beforeEach(() => {
  rpcMock.mockReset();
});

describe("canonical Festival scheduling service", () => {
  it("resolves a festival_editions_v2 id before loading the existing schedule workspace", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: bridgeResult, error: null })
      .mockResolvedValueOnce({ data: workspaceResult, error: null });

    await expect(fetchFestivalScheduleWorkspace(canonicalEditionId)).resolves.toMatchObject({
      edition: { id: scheduleEditionId },
      timeZone: "Europe/London",
    });

    expect(rpcMock).toHaveBeenNthCalledWith(1, "ensure_festival_v2_schedule_bridge", {
      p_festival_edition_id: canonicalEditionId,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "festival_edition_schedule_workspace", {
      p_edition_id: scheduleEditionId,
    });
  });

  it("uses the resolved schedule edition and clamps invalid durations before mutation", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: bridgeResult, error: null })
      .mockResolvedValueOnce({ data: { id: "slot-1" }, error: null });

    await upsertScheduleItem({
      editionId: canonicalEditionId,
      revisionId: "55555555-5555-4555-8555-555555555555",
      item: {
        title: "Invalid duration input",
        durationMinutes: 0,
      },
      idempotencyKey: "test-idempotency-key",
    });

    expect(rpcMock).toHaveBeenNthCalledWith(2, "festival_schedule_upsert_item", {
      p_edition_id: scheduleEditionId,
      p_revision_id: "55555555-5555-4555-8555-555555555555",
      p_item: {
        title: "Invalid duration input",
        durationMinutes: 1,
      },
      p_expected_version: null,
      p_idempotency_key: "test-idempotency-key",
    });
  });
});
