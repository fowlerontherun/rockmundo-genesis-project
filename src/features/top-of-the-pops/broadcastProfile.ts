export type TotpStageKey = "main_stage" | "stage_b" | "rock_stage" | "studio_floor";

export type TotpCameraShot =
  | "presenter_wide"
  | "presenter_close"
  | "crane_sweep"
  | "studio_master"
  | "lead_close"
  | "lead_medium"
  | "instrument_close"
  | "drummer_close"
  | "side_tracking"
  | "low_angle"
  | "audience_reverse"
  | "audience_dance"
  | "overhead"
  | "push_in"
  | "pull_back"
  | "finale_wide";

export interface TotpBroadcastProfile {
  key: "totp_classic";
  viewerMode: "totp";
  presenterKey: string;
  defaultStage: TotpStageKey;
  availableStages: TotpStageKey[];
  camerasVisibleInScene: boolean;
  audienceStyle: "tv_studio";
  graphicsPackage: "totp_classic";
  shotLibrary: TotpCameraShot[];
  cutOnMusicalSections: boolean;
  allowFreeCameraDuringBroadcast: false;
}

export const TOTP_CLASSIC_BROADCAST_PROFILE: TotpBroadcastProfile = {
  key: "totp_classic",
  viewerMode: "totp",
  presenterKey: "alex_rayne",
  defaultStage: "main_stage",
  availableStages: ["main_stage", "stage_b", "rock_stage", "studio_floor"],
  camerasVisibleInScene: true,
  audienceStyle: "tv_studio",
  graphicsPackage: "totp_classic",
  shotLibrary: [
    "presenter_wide",
    "presenter_close",
    "crane_sweep",
    "studio_master",
    "lead_close",
    "lead_medium",
    "instrument_close",
    "drummer_close",
    "side_tracking",
    "low_angle",
    "audience_reverse",
    "audience_dance",
    "overhead",
    "push_in",
    "pull_back",
    "finale_wide",
  ],
  cutOnMusicalSections: true,
  allowFreeCameraDuringBroadcast: false,
};

export type TotpSongEnergy = "low" | "medium" | "high";

export interface TotpDirectionContext {
  genre?: string | null;
  energy?: TotpSongEnergy | null;
  performerCount: number;
}

/**
 * Chooses a television stage without affecting gameplay rewards. This is a visual
 * direction decision only; players cannot optimise chart/fame outcomes through it.
 */
export function chooseTotpStage(context: TotpDirectionContext): TotpStageKey {
  const genre = context.genre?.toLowerCase() ?? "";
  if (/metal|punk|rock|grunge|hardcore/.test(genre)) return "rock_stage";
  if (/acoustic|folk|singer|songwriter/.test(genre) || context.energy === "low") return "studio_floor";
  if (context.performerCount <= 2) return "stage_b";
  return "main_stage";
}

/**
 * Initial deterministic shot grammar for the dedicated TV broadcast viewer.
 * Phase 2 will map these shot names onto the existing Gig Viewer CameraDirector.
 */
export function buildTotpShotGrammar(context: TotpDirectionContext): TotpCameraShot[] {
  const genre = context.genre?.toLowerCase() ?? "";
  const highEnergy = context.energy === "high" || /metal|punk|rock|dance|electronic/.test(genre);

  if (highEnergy) {
    return [
      "crane_sweep",
      "lead_close",
      "instrument_close",
      "side_tracking",
      "drummer_close",
      "audience_reverse",
      "low_angle",
      "push_in",
      "studio_master",
      "finale_wide",
    ];
  }

  return [
    "crane_sweep",
    "lead_medium",
    "lead_close",
    "audience_dance",
    "studio_master",
    "push_in",
    "lead_close",
    "pull_back",
    "finale_wide",
  ];
}
