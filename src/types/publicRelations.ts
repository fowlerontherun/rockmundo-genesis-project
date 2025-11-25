export type PRCampaignStatus =
  | "planned"
  | "active"
  | "pending"
  | "completed"
  | "cancelled"
  | "declined";

export interface PRCampaign {
  id: string;
  band_id: string;
  campaign_type: string;
  campaign_name: string;
  budget: number;
  start_date: string;
  end_date: string;
  status: PRCampaignStatus;
  reach: number;
  engagement_rate: number;
  media_impressions: number;
  created_at: string;
}

export interface MediaAppearance {
  id: string;
  band_id: string;
  media_type: string;
  program_name: string;
  network: string;
  air_date: string;
  audience_reach: number;
  sentiment: "positive" | "neutral" | "negative";
  highlight: string;
  created_at: string;
}

export interface MediaOffer {
  id: string;
  band_id: string;
  media_type: string;
  program_name: string;
  network: string;
  proposed_date: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  compensation: number;
  created_at: string;
}

export type PRCampaignCreateInput = Pick<
  PRCampaign,
  "campaign_type" | "campaign_name" | "budget" | "start_date" | "end_date"
>;

export interface PressReleaseItem {
  id: string;
  band_id: string;
  title: string;
  release_date: string;
  distribution_channel: string;
  link?: string;
  sentiment?: "positive" | "neutral" | "negative";
  summary?: string;
}

export interface MediaContact {
  id: string;
  band_id: string;
  name: string;
  outlet: string;
  role: string;
  email: string;
  phone?: string;
  preferred_channel?: "email" | "phone" | "social";
  notes?: string;
  last_outreach?: string;
}

export interface OutreachTask {
  id: string;
  band_id: string;
  contact_id?: string;
  related_campaign_id?: string;
  task_type:
    | "press_release"
    | "booking"
    | "follow_up"
    | "briefing"
    | "reporting";
  summary: string;
  due_date: string;
  status: "open" | "in_progress" | "completed" | "blocked";
}

export interface PRSentimentSnapshot {
  id: string;
  band_id: string;
  channel: string;
  score: number;
  captured_at: string;
  notes?: string;
}
