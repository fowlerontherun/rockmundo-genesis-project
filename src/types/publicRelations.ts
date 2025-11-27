export enum PressReleaseStatus {
  Draft = "draft",
  Scheduled = "scheduled",
  Published = "published",
  Archived = "archived",
}

export enum OutreachStage {
  Research = "research",
  Contacted = "contacted",
  FollowUp = "follow_up",
  Negotiating = "negotiating",
  Confirmed = "confirmed",
  CoverageSecured = "coverage_secured",
  NotMovingForward = "not_moving_forward",
}

export enum OutreachTaskStatus {
  Open = "open",
  InProgress = "in_progress",
  Completed = "completed",
  Blocked = "blocked",
}

export interface PressRelease {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  releaseDate: string;
  status: PressReleaseStatus;
  heroImageUrl?: string;
  relatedAssets?: string[];
  contactIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaContact {
  id: string;
  name: string;
  outlet: string;
  role: string;
  email: string;
  phone?: string;
  region?: string;
  topics?: string[];
  notes?: string;
  lastContactedAt?: string;
}

export interface OutreachTask {
  id: string;
  title: string;
  description?: string;
  pressReleaseId?: string;
  contactId?: string;
  stage: OutreachStage;
  status: OutreachTaskStatus;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}

export interface MediaAppearance {
  id: string;
  title: string;
  type: string;
  scheduledDate: string;
  status: string;
  reach?: number;
  createdAt: string;
}

export interface MediaOffer {
  id: string;
  title: string;
  type: string;
  deadline: string;
  payout?: number;
  status: string;
  createdAt: string;
}

export interface PRCampaign {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate?: string;
  budget?: number;
  createdAt: string;
}

export interface PRCampaignCreateInput {
  name: string;
  startDate: string;
  endDate?: string;
  budget?: number;
}
