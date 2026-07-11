import type { GearModifierEffects } from "@/utils/gearModifiers";

export type ReportMetricStatus = "available" | "processing" | "legacy_missing" | "not_applicable";

export type ReportMetric<T> =
  | { status: "available"; value: T; source?: "authoritative" | "legacy" | "derived" }
  | { status: "processing"; reason: string }
  | { status: "legacy_missing"; reason: string }
  | { status: "not_applicable"; reason: string };

export interface GigExperienceGigDTO {
  id: string;
  bandId: string | null;
  status: string;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  ticketPrice: ReportMetric<number>;
  venue: { id: string | null; name: string; location: string | null; capacity: number };
}

export interface GigExperienceHeadlineDTO {
  overallRating: ReportMetric<number>;
  performanceGrade: ReportMetric<string>;
  verdict: string;
  attendance: ReportMetric<number>;
  capacity: ReportMetric<number>;
  netProfit: ReportMetric<number>;
  fameGained: ReportMetric<number>;
  fansGained: ReportMetric<number>;
  bestSongTitle: ReportMetric<string>;
}

export interface GigExperienceSongAudioDTO { available: boolean; sourceType: "generated_full" | "preview" | "fixture" | "none"; url: string | null; durationSeconds: number | null; generationStatus: string | null; permissionState: "allowed" | "denied" | "public" | "admin_demo"; reasonUnavailable?: string }

export interface GigExperienceSongDTO {
  id: string;
  songId: string | null;
  position: number;
  title: string;
  performanceScore: ReportMetric<number>;
  crowdResponse: ReportMetric<string>;
  audio?: GigExperienceSongAudioDTO;
  contributions: {
    songQuality: ReportMetric<number>;
    rehearsal: ReportMetric<number>;
    chemistry: ReportMetric<number>;
    equipment: ReportMetric<number>;
    crew: ReportMetric<number>;
    memberSkill: ReportMetric<number>;
  };
}

export interface GigExperiencePerformerDTO {
  id: string;
  profileId: string;
  displayName: string;
  roleOrInstrument: string | null;
  lineupStatus: string;
}

export interface GigExperienceFinancesDTO {
  ticketRevenue: ReportMetric<number>;
  merchRevenue: ReportMetric<number>;
  totalRevenue: ReportMetric<number>;
  crewCosts: ReportMetric<number>;
  equipmentWearCost: ReportMetric<number>;
  venueCost: ReportMetric<number>;
  totalCosts: ReportMetric<number>;
  netProfit: ReportMetric<number>;
  merchItemsSold: ReportMetric<number>;
}

export interface GigExperienceProgressionDTO {
  fameGained: ReportMetric<number>;
  chemistryChange: ReportMetric<number>;
  totalXpAwarded: ReportMetric<number>;
  fansGained: ReportMetric<number>;
  fanConversions: ReportMetric<number>;
}

export interface GigExperienceAnalysisDTO {
  equipmentQuality: ReportMetric<number>;
  crewSkill: ReportMetric<number>;
  bandChemistry: ReportMetric<number>;
  memberSkills: ReportMetric<number>;
  crowdEnergyPeak: ReportMetric<number>;
  stageBehaviorUsed: ReportMetric<string>;
  gearEffects: GearModifierEffects | null;
  warnings: string[];
}

export interface GigExperienceDTO {
  schemaVersion: 1;
  gig: GigExperienceGigDTO;
  headline: GigExperienceHeadlineDTO;
  songs: GigExperienceSongDTO[];
  performers: GigExperiencePerformerDTO[];
  finances: GigExperienceFinancesDTO;
  progression: GigExperienceProgressionDTO;
  analysis: GigExperienceAnalysisDTO;
  lessons: { worked: string[]; heldBack: string[]; recommendations: string[] };
  viewer: { ready: boolean; outcomeId: string | null; resultReadyAt: string | null; replayAvailable: boolean; replay?: { viewerVersion: number | null; durationMs: number | null; generationStatus: string | null } };
}

export interface GigExperienceValidationError { field: string; message: string }
