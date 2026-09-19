import { describe, expect, it } from "vitest";
import { deriveTotpCameraFrame } from "./cameraDirector";

const performers = [
  { id: "lead", position: { x: 640, y: 220 }, role: "Lead Vocals", isLead: true },
  { id: "guitar", position: { x: 570, y: 235 }, role: "Lead Guitar" },
  { id: "drums", position: { x: 735, y: 205 }, role: "Drums" },
];

describe("deriveTotpCameraFrame", () => {
  it("targets the lead performer for lead close-ups", () => {
    const frame = deriveTotpCameraFrame({ shot: "lead_close", stage: "main_stage", performers });
    expect(frame.subjectId).toBe("lead");
    expect(frame.camera.zoom).toBe(1.2);
  });

  it("targets the drummer for drummer close-ups", () => {
    const frame = deriveTotpCameraFrame({ shot: "drummer_close", stage: "main_stage", performers });
    expect(frame.subjectId).toBe("drums");
  });

  it("falls back to a stable studio master when reduced motion is enabled", () => {
    const frame = deriveTotpCameraFrame({ shot: "crane_sweep", stage: "rock_stage", performers, reducedMotion: true });
    expect(frame.shot).toBe("studio_master");
    expect(frame.camera).toEqual({ x: 640, y: 360, zoom: 1 });
  });
});
