import type { Point, Rect, Size } from "@/features/gig-experience/viewer/engine/Viewport";

export const TOTP_STUDIO_SCENE_SIZE: Readonly<Size> = Object.freeze({ width: 1280, height: 720 });

export interface TotpStudioLayout {
  presenter: Point;
  mainStage: Rect;
  stageB: Rect;
  rockStage: Rect;
  studioFloor: Rect;
  audience: Rect;
  cameraCrane: Point;
  pedestalCameraLeft: Point;
  pedestalCameraRight: Point;
  handheldCamera: Point;
  overheadCamera: Point;
}

/**
 * Permanent London television studio authored in the same 1280x720 logical space as
 * the shared Gig Viewer. Keeping the same space lets the existing renderer reuse
 * transforms, performer placement and reduced-motion behavior without a fork.
 */
export const TOTP_STUDIO_LAYOUT: Readonly<TotpStudioLayout> = Object.freeze({
  presenter: { x: 176, y: 174 },
  mainStage: { x: 430, y: 92, width: 470, height: 235 },
  stageB: { x: 945, y: 168, width: 240, height: 170 },
  rockStage: { x: 70, y: 350, width: 350, height: 215 },
  studioFloor: { x: 495, y: 392, width: 320, height: 178 },
  audience: { x: 325, y: 325, width: 690, height: 320 },
  cameraCrane: { x: 1050, y: 90 },
  pedestalCameraLeft: { x: 350, y: 590 },
  pedestalCameraRight: { x: 935, y: 590 },
  handheldCamera: { x: 525, y: 485 },
  overheadCamera: { x: 640, y: 52 },
});

export type TotpStudioStageKey = "main_stage" | "stage_b" | "rock_stage" | "studio_floor";

export function getTotpStageRect(stage: TotpStudioStageKey): Rect {
  switch (stage) {
    case "stage_b": return TOTP_STUDIO_LAYOUT.stageB;
    case "rock_stage": return TOTP_STUDIO_LAYOUT.rockStage;
    case "studio_floor": return TOTP_STUDIO_LAYOUT.studioFloor;
    default: return TOTP_STUDIO_LAYOUT.mainStage;
  }
}

export function centerOf(rect: Rect, relativeY = 0.5): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height * relativeY };
}
