export type SentimentTone = "positive" | "neutral" | "negative";

export type ReleaseStatus = "draft" | "scheduled" | "published";

export interface PressRelease {
  id: string;
  title: string;
  channel: string;
  date: string;
  status: ReleaseStatus;
  sentiment: SentimentTone;
  reach: number;
  notes?: string;
}

export interface PressReleaseFormValues {
  title: string;
  channel: string;
  date: string;
  status: ReleaseStatus;
  notes?: string;
}

export interface MediaContact {
  id: string;
  name: string;
  outlet: string;
  role: string;
  email: string;
  region: string;
  lastEngaged: string;
  preferredChannel: string;
  sentiment?: SentimentTone;
}

export interface OutreachStage {
  id: string;
  label: string;
  prospects: number;
  conversionRate: number;
  nextStep?: string;
}

export interface SentimentSnapshot {
  score: number;
  trend: "up" | "down" | "flat";
  summary: string;
  mentions: number;
}
