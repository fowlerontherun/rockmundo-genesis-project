import { describe, expect, it } from "vitest";
import { ensureRecordingStage, ensureRecordingStatus, getNextStage, getRecordingWorkflowState, hasRemainingStages, isValidStatusTransition } from "@/lib/workflows/recording";

describe("recording workflow regressions", () => {
  it("falls back safely for unknown persisted stage and status values", () => {
    expect(ensureRecordingStage("bad-stage")).toBe("recording");
    expect(ensureRecordingStatus("bad-status")).toBe("scheduled");
  });

  it("keeps allowed status transitions narrow", () => {
    expect(isValidStatusTransition("scheduled", "in_progress")).toBe(true);
    expect(isValidStatusTransition("scheduled", "completed")).toBe(false);
    expect(isValidStatusTransition("completed", "cancelled")).toBe(false);
  });

  it("marks prior recording stages complete and current mixing work active", () => {
    const stages = getRecordingWorkflowState("mixing", "in_progress");

    expect(stages.map(stage => stage.progress)).toEqual(["completed", "active", "pending"]);
    expect(stages[1]?.tasks[0]?.status).toBe("in_progress");
    expect(stages[1]?.collaborators.every(collaborator => collaborator.status === "active")).toBe(true);
  });

  it("detects the end of the recording pipeline", () => {
    expect(getNextStage("recording")).toBe("mixing");
    expect(hasRemainingStages("mixing")).toBe(true);
    expect(hasRemainingStages("mastering")).toBe(false);
  });
});
