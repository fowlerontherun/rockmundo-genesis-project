import type { Tables } from "@/lib/supabase-types";

export type AnalyticsExperimentRecord = Tables<"marketing_experiments">;
export type AnalyticsVariantRecord = Tables<"marketing_experiment_variants">;

export interface CampaignVariantTimeseriesPoint {
  date: string;
  conversionRate: number;
  revenue: number;
  engagementRate: number;
}

export interface CampaignVariantPerformance {
  id: string;
  name: string;
  description: string;
  messageFocus: string;
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  uplift: number;
  totalRevenue: number;
  revenuePerVisitor: number;
  retentionRate: number;
  engagementRate: number;
  bounceRate: number;
  isWinning?: boolean;
  highlights: string[];
  timeseries: CampaignVariantTimeseriesPoint[];
}

export interface CampaignExperiment {
  id: string;
  name: string;
  status: "running" | "completed" | "paused";
  objective: string;
  description: string;
  targetSegment: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  startDate: string;
  endDate?: string;
  confidence: number;
  variants: CampaignVariantPerformance[];
}

export interface CampaignExperimentsSummary {
  totalExperiments: number;
  runningExperiments: number;
  avgConversionLift: number;
  activeReach: number;
  bestVariantName: string;
}

export interface CampaignExperimentsResponse {
  summary: CampaignExperimentsSummary;
  experiments: CampaignExperiment[];
}

const mockExperiments: CampaignExperimentsResponse = {
  summary: {
    totalExperiments: 8,
    runningExperiments: 3,
    avgConversionLift: 18.4,
    activeReach: 2450000,
    bestVariantName: "Storyteller Landing",
  },
  experiments: [
    {
      id: "pre-save-surge",
      name: "Pre-save Surge Experiment",
      status: "running",
      objective: "Increase pre-save conversions for the upcoming album drop.",
      description:
        "Testing narrative-driven storytelling against social proof heavy creative to nudge streaming-first fans into pre-saving the album.",
      targetSegment: "Gen Z streaming superfans",
      primaryMetric: "Pre-save conversion rate",
      secondaryMetrics: ["Click-through rate", "Listener retention", "Merch opt-ins"],
      startDate: "2024-07-01",
      confidence: 87,
      variants: [
        {
          id: "storyteller",
          name: "Storyteller Landing",
          description: "Long-form landing page with documentary footage and emotive testimonials.",
          messageFocus: "Emotional storytelling",
          sampleSize: 12800,
          conversions: 642,
          conversionRate: 5.01,
          uplift: 22.3,
          totalRevenue: 15840,
          revenuePerVisitor: 1.24,
          retentionRate: 72,
          engagementRate: 78,
          bounceRate: 18,
          isWinning: true,
          highlights: [
            "Documentary clip increases watch time by 31%",
            "Fan quotes drive 14% more social shares",
          ],
          timeseries: [
            { date: "2024-07-01", conversionRate: 4.2, revenue: 3200, engagementRate: 72 },
            { date: "2024-07-05", conversionRate: 4.7, revenue: 3800, engagementRate: 75 },
            { date: "2024-07-10", conversionRate: 5.1, revenue: 4200, engagementRate: 78 },
            { date: "2024-07-15", conversionRate: 5.3, revenue: 4400, engagementRate: 80 },
            { date: "2024-07-20", conversionRate: 5.6, revenue: 4640, engagementRate: 82 },
          ],
        },
        {
          id: "social-proof",
          name: "Social Proof Blitz",
          description: "Social carousel featuring community stats and influencer duets.",
          messageFocus: "Community momentum",
          sampleSize: 12450,
          conversions: 508,
          conversionRate: 4.08,
          uplift: 12.4,
          totalRevenue: 14210,
          revenuePerVisitor: 1.14,
          retentionRate: 66,
          engagementRate: 71,
          bounceRate: 24,
          highlights: [
            "Influencer duet adds +9% to click-through",
            "Leaderboard stats boost trust for late-night traffic",
          ],
          timeseries: [
            { date: "2024-07-01", conversionRate: 3.6, revenue: 3000, engagementRate: 68 },
            { date: "2024-07-05", conversionRate: 3.9, revenue: 3200, engagementRate: 69 },
            { date: "2024-07-10", conversionRate: 4.1, revenue: 3400, engagementRate: 71 },
            { date: "2024-07-15", conversionRate: 4.2, revenue: 3560, engagementRate: 72 },
            { date: "2024-07-20", conversionRate: 4.3, revenue: 3670, engagementRate: 72 },
          ],
        },
        {
          id: "sms-pre-save",
          name: "SMS Warm-Up",
          description: "Text-first drip sequence with episodic lore drops.",
          messageFocus: "Exclusive access",
          sampleSize: 9400,
          conversions: 468,
          conversionRate: 4.98,
          uplift: 19.1,
          totalRevenue: 13480,
          revenuePerVisitor: 1.32,
          retentionRate: 74,
          engagementRate: 69,
          bounceRate: 16,
          highlights: [
            "SMS prompts deliver 2x repeat visits",
            "Lore-driven cliffhangers improve retention in final 48 hours",
          ],
          timeseries: [
            { date: "2024-07-01", conversionRate: 4.1, revenue: 2800, engagementRate: 66 },
            { date: "2024-07-05", conversionRate: 4.5, revenue: 3000, engagementRate: 68 },
            { date: "2024-07-10", conversionRate: 5, revenue: 3200, engagementRate: 70 },
            { date: "2024-07-15", conversionRate: 5.2, revenue: 3400, engagementRate: 71 },
            { date: "2024-07-20", conversionRate: 5.3, revenue: 3480, engagementRate: 70 },
          ],
        },
      ],
    },
    {
      id: "merch-drop-boost",
      name: "Merch Drop Booster",
      status: "completed",
      objective: "Optimize cross-sell funnel for the summer tour merch drop.",
      description:
        "Evaluating bundle offers against limited-edition scarcity messaging to maximize per-order value without hurting conversion.",
      targetSegment: "Returning supporters from last tour",
      primaryMetric: "Average order value",
      secondaryMetrics: ["Cart conversion", "Merch margin", "Add-on rate"],
      startDate: "2024-05-12",
      endDate: "2024-06-03",
      confidence: 94,
      variants: [
        {
          id: "bundle-builder",
          name: "Bundle Builder",
          description: "Interactive bundle configurator with savings meter.",
          messageFocus: "Value stacking",
          sampleSize: 15200,
          conversions: 1214,
          conversionRate: 7.99,
          uplift: 27.5,
          totalRevenue: 32840,
          revenuePerVisitor: 2.16,
          retentionRate: 68,
          engagementRate: 76,
          bounceRate: 21,
          isWinning: true,
          highlights: [
            "Average order value up 22% versus control",
            "Savings meter increases completion rate for high-margin add-ons",
          ],
          timeseries: [
            { date: "2024-05-12", conversionRate: 6.9, revenue: 6200, engagementRate: 70 },
            { date: "2024-05-17", conversionRate: 7.5, revenue: 6600, engagementRate: 73 },
            { date: "2024-05-22", conversionRate: 8.2, revenue: 7200, engagementRate: 77 },
            { date: "2024-05-27", conversionRate: 8.4, revenue: 7800, engagementRate: 79 },
            { date: "2024-06-03", conversionRate: 8.6, revenue: 8040, engagementRate: 80 },
          ],
        },
        {
          id: "scarcity",
          name: "Scarcity Countdown",
          description: "Limited run poster drop with real-time stock meter and VIP pass upsell.",
          messageFocus: "Limited availability",
          sampleSize: 14840,
          conversions: 988,
          conversionRate: 6.66,
          uplift: 18.9,
          totalRevenue: 29460,
          revenuePerVisitor: 1.98,
          retentionRate: 62,
          engagementRate: 71,
          bounceRate: 25,
          highlights: [
            "VIP upsell attaches to 34% of high-value orders",
            "Live stock meter reduces bounce rate during final 6 hours",
          ],
          timeseries: [
            { date: "2024-05-12", conversionRate: 5.8, revenue: 5400, engagementRate: 66 },
            { date: "2024-05-17", conversionRate: 6.2, revenue: 5800, engagementRate: 68 },
            { date: "2024-05-22", conversionRate: 6.6, revenue: 6200, engagementRate: 70 },
            { date: "2024-05-27", conversionRate: 6.8, revenue: 6600, engagementRate: 72 },
            { date: "2024-06-03", conversionRate: 7.1, revenue: 7460, engagementRate: 73 },
          ],
        },
      ],
    },
    {
      id: "patron-drive",
      name: "Patron Drive Messaging",
      status: "running",
      objective: "Identify the best pitch to grow recurring patron support tiers.",
      description:
        "Comparing narrative-driven storytelling, behind-the-scenes incentives, and exclusive premieres to increase recurring patron sign-ups.",
      targetSegment: "Long-time newsletter readers",
      primaryMetric: "Patron conversion rate",
      secondaryMetrics: ["Trial-to-paid", "Average pledge", "Referral rate"],
      startDate: "2024-06-15",
      confidence: 79,
      variants: [
        {
          id: "studio-pass",
          name: "Studio Pass",
          description: "Behind-the-scenes livestream access and early demo polls.",
          messageFocus: "Creative collaboration",
          sampleSize: 8800,
          conversions: 382,
          conversionRate: 4.34,
          uplift: 16.2,
          totalRevenue: 11280,
          revenuePerVisitor: 1.28,
          retentionRate: 76,
          engagementRate: 84,
          bounceRate: 14,
          isWinning: true,
          highlights: [
            "Livestream AMA boosts trial-to-paid conversion by 12%",
            "Fan voting widgets double referral rate week-over-week",
          ],
          timeseries: [
            { date: "2024-06-15", conversionRate: 3.9, revenue: 2800, engagementRate: 80 },
            { date: "2024-06-20", conversionRate: 4.1, revenue: 3200, engagementRate: 82 },
            { date: "2024-06-25", conversionRate: 4.3, revenue: 3600, engagementRate: 84 },
            { date: "2024-06-30", conversionRate: 4.6, revenue: 3800, engagementRate: 86 },
            { date: "2024-07-05", conversionRate: 4.7, revenue: 3880, engagementRate: 85 },
          ],
        },
        {
          id: "premiere",
          name: "Premiere Vault",
          description: "Monthly unreleased premiere with exclusive community drop nights.",
          messageFocus: "First access",
          sampleSize: 9100,
          conversions: 344,
          conversionRate: 3.78,
          uplift: 11.6,
          totalRevenue: 10120,
          revenuePerVisitor: 1.12,
          retentionRate: 71,
          engagementRate: 77,
          bounceRate: 19,
          highlights: [
            "Release-night viewing parties spike pledges by 19%",
            "Private discord unlock reduces churn in first 30 days",
          ],
          timeseries: [
            { date: "2024-06-15", conversionRate: 3.3, revenue: 2400, engagementRate: 74 },
            { date: "2024-06-20", conversionRate: 3.6, revenue: 2600, engagementRate: 75 },
            { date: "2024-06-25", conversionRate: 3.8, revenue: 2720, engagementRate: 77 },
            { date: "2024-06-30", conversionRate: 3.9, revenue: 2800, engagementRate: 78 },
            { date: "2024-07-05", conversionRate: 4, revenue: 2880, engagementRate: 78 },
          ],
        },
        {
          id: "impact-story",
          name: "Impact Story",
          description: "Documentary letter from the road with fan impact spotlights.",
          messageFocus: "Community impact",
          sampleSize: 8700,
          conversions: 298,
          conversionRate: 3.42,
          uplift: 9.4,
          totalRevenue: 9120,
          revenuePerVisitor: 1.05,
          retentionRate: 69,
          engagementRate: 74,
          bounceRate: 22,
          highlights: [
            "Tour diary stories extend session duration by 18%",
            "Matching donation callouts increase referral shares by 8%",
          ],
          timeseries: [
            { date: "2024-06-15", conversionRate: 3.1, revenue: 2200, engagementRate: 70 },
            { date: "2024-06-20", conversionRate: 3.3, revenue: 2360, engagementRate: 72 },
            { date: "2024-06-25", conversionRate: 3.4, revenue: 2460, engagementRate: 73 },
            { date: "2024-06-30", conversionRate: 3.5, revenue: 2540, engagementRate: 74 },
            { date: "2024-07-05", conversionRate: 3.6, revenue: 2620, engagementRate: 74 },
          ],
        },
      ],
    },
  ],
};

export const fetchCampaignExperiments = async (): Promise<CampaignExperimentsResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return mockExperiments;
};

