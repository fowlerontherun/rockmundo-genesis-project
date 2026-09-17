import { clampCamera, type SceneCamera } from "@/features/gig-experience/viewer/engine/SceneLayout";
import type { Point } from "@/features/gig-experience/viewer/engine/Viewport";
import type { TotpCameraShot, TotpStageKey } from "./broadcastProfile";
import { TOTP_STUDIO_LAYOUT, TOTP_STUDIO_SCENE_SIZE, centerOf, getTotpStageRect } from "./studioLayout";

export interface TotpPerformerCameraTarget {
  id: string;
  position: Point;
  role?: string | null;
  isLead?: boolean;
}

export interface TotpCameraFrame {
  camera: SceneCamera;
  shot: TotpCameraShot;
  subjectId: string | null;
  showAudienceForeground: boolean;
  showCameraRigInFrame: boolean;
}

export interface TotpCameraContext {
  shot: TotpCameraShot;
  stage: TotpStageKey;
  performers?: TotpPerformerCameraTarget[];
  shotIndex?: number;
  reducedMotion?: boolean;
}

/**
 * Maps TOTP's TV shot language into the existing Gig Viewer SceneCamera model.
 * This function is pure and deterministic, so seeking/replaying a broadcast does
 * not change camera direction or create a second playback clock.
 */
export function deriveTotpCameraFrame(context: TotpCameraContext): TotpCameraFrame {
  const stage = getTotpStageRect(context.stage);
  const stageCenter = centerOf(stage, 0.52);
  const lead = pickLead(context.performers ?? []);
  const instrument = pickInstrument(context.performers ?? [], context.shotIndex ?? 0);
  const drummer = (context.performers ?? []).find((p) => /drum/i.test(p.role ?? "")) ?? instrument;

  if (context.reducedMotion) {
    return frame("studio_master", { x: 640, y: 350, zoom: 1 }, null, false, true);
  }

  switch (context.shot) {
    case "presenter_close":
      return frame(context.shot, focus(TOTP_STUDIO_LAYOUT.presenter, 1.2), "presenter", false, false);
    case "presenter_wide":
      return frame(context.shot, focus({ x: 300, y: 245 }, 1.08), "presenter", true, true);
    case "crane_sweep":
      return frame(context.shot, focus({ x: stageCenter.x, y: Math.max(250, stageCenter.y + 90) }, 1.02), null, true, true);
    case "lead_close":
      return frame(context.shot, focus(lead?.position ?? stageCenter, 1.2), lead?.id ?? null, false, false);
    case "lead_medium":
      return frame(context.shot, focus(lead?.position ?? stageCenter, 1.14), lead?.id ?? null, false, false);
    case "instrument_close":
      return frame(context.shot, focus(instrument?.position ?? stageCenter, 1.18), instrument?.id ?? null, false, false);
    case "drummer_close":
      return frame(context.shot, focus(drummer?.position ?? stageCenter, 1.18), drummer?.id ?? null, false, false);
    case "side_tracking":
      return frame(context.shot, focus({ x: stageCenter.x + stage.width * 0.12, y: stageCenter.y }, 1.12), null, false, true);
    case "low_angle":
      return frame(context.shot, focus({ x: lead?.position.x ?? stageCenter.x, y: Math.min(650, (lead?.position.y ?? stageCenter.y) + 70) }, 1.16), lead?.id ?? null, false, false);
    case "audience_reverse":
      return frame(context.shot, focus({ x: stageCenter.x, y: 415 }, 1.08), null, true, false);
    case "audience_dance":
      return frame(context.shot, focus(centerOf(TOTP_STUDIO_LAYOUT.audience, 0.45), 1.1), null, true, true);
    case "overhead":
      return frame(context.shot, { x: 640, y: 360, zoom: 1 }, null, true, true);
    case "push_in":
      return frame(context.shot, focus(lead?.position ?? stageCenter, 1.17), lead?.id ?? null, false, false);
    case "pull_back":
      return frame(context.shot, focus({ x: stageCenter.x, y: stageCenter.y + 100 }, 1.04), null, true, true);
    case "finale_wide":
      return frame(context.shot, { x: 640, y: 360, zoom: 1 }, null, true, true);
    case "studio_master":
    default:
      return frame(context.shot, focus({ x: stageCenter.x, y: 360 }, 1.03), null, true, true);
  }
}

function focus(point: Point, zoom: number): SceneCamera {
  return clampCamera({ x: point.x, y: point.y, zoom }, TOTP_STUDIO_SCENE_SIZE);
}

function frame(shot: TotpCameraShot, camera: SceneCamera, subjectId: string | null, showAudienceForeground: boolean, showCameraRigInFrame: boolean): TotpCameraFrame {
  return { camera: clampCamera(camera, TOTP_STUDIO_SCENE_SIZE), shot, subjectId, showAudienceForeground, showCameraRigInFrame };
}

function pickLead(performers: TotpPerformerCameraTarget[]) {
  return performers.find((p) => p.isLead) ?? performers.find((p) => /voc|singer|front/i.test(p.role ?? "")) ?? performers[0] ?? null;
}

function pickInstrument(performers: TotpPerformerCameraTarget[], index: number) {
  const instrumentalists = performers.filter((p) => !p.isLead && !/voc|singer|front/i.test(p.role ?? ""));
  if (!instrumentalists.length) return performers[index % Math.max(1, performers.length)] ?? null;
  return instrumentalists[Math.abs(index) % instrumentalists.length];
}
