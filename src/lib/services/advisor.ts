import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

export type AdvisorSuggestionCategory =
  | "momentum"
  | "retention"
  | "engagement"
  | "monetization"
  | "setup";

export interface AdvisorSuggestionAction {
  label: string;
  href: string;
}

export interface AdvisorSuggestionMetric {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
}

export interface AdvisorSuggestion {
  id: string;
  title: string;
  message: string;
  category: AdvisorSuggestionCategory;
  metrics: AdvisorSuggestionMetric[];
  actions: AdvisorSuggestionAction[];
}

export interface AdvisorSummary {
  totalStreams7Days: number;
  totalRevenue7Days: number;
  listenerReach7Days: number;
  updatedAt: string | null;
  topMomentumTrack?: {
    title: string;
    growthRate: number;
    currentStreams: number;
  };
}

export interface AdvisorInsights {
  summary: AdvisorSummary;
  suggestions: AdvisorSuggestion[];
}

type StreamingDailyRow = Database["public"]["Tables"]["streaming_analytics_daily"]["Row"];
type SongReleaseRow = Database["public"]["Tables"]["song_releases"]["Row"] & {
  songs?: {
    title: string | null;
    genre: string | null;
  } | null;
};

type ReleaseSummary = {
  releaseId: string;
  title: string;
  genre: string | null;
  totalStreams: number;
  totalRevenue: number;
  totalListeners: number;
  currentStreams: number;
  currentRevenue: number;
  currentListeners: number;
  previousStreams: number;
  previousRevenue: number;
  avgSkipRate: number | null;
  avgCompletionRate: number | null;
  topPlatform?: {
    name: string;
    streams: number;
    revenue: number;
    avgSkipRate: number | null;
  };
  latestDate: Date | null;
};

const DEFAULT_SUMMARY: AdvisorSummary = {
  totalStreams7Days: 0,
  totalRevenue7Days: 0,
  listenerReach7Days: 0,
  updatedAt: null,
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(0)}%`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString();
};

const toDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateReleaseSummaries = (
  releases: SongReleaseRow[],
  analytics: StreamingDailyRow[],
): ReleaseSummary[] => {
  const metricsByRelease = new Map<string, StreamingDailyRow[]>();

  analytics.forEach((row) => {
    if (!row.song_release_id) return;
    const collection = metricsByRelease.get(row.song_release_id) ?? [];
    collection.push(row);
    metricsByRelease.set(row.song_release_id, collection);
  });

  return releases.map((release) => {
    const metrics = (metricsByRelease.get(release.id) ?? []).sort((a, b) => {
      const dateA = toDate(a.analytics_date)?.getTime() ?? 0;
      const dateB = toDate(b.analytics_date)?.getTime() ?? 0;
      return dateA - dateB;
    });

    if (metrics.length === 0) {
      return {
        releaseId: release.id,
        title: release.songs?.title ?? "Untitled track",
        genre: release.songs?.genre ?? null,
        totalStreams: 0,
        totalRevenue: 0,
        totalListeners: 0,
        currentStreams: 0,
        currentRevenue: 0,
        currentListeners: 0,
        previousStreams: 0,
        previousRevenue: 0,
        avgSkipRate: null,
        avgCompletionRate: null,
        latestDate: null,
      } satisfies ReleaseSummary;
    }

    const latestDate = toDate(metrics[metrics.length - 1]?.analytics_date ?? null);
    const currentWindowStart = latestDate ? new Date(latestDate) : null;
    if (currentWindowStart) {
      currentWindowStart.setUTCDate(currentWindowStart.getUTCDate() - 6);
    }
    const previousWindowStart = currentWindowStart ? new Date(currentWindowStart) : null;
    if (previousWindowStart) {
      previousWindowStart.setUTCDate(previousWindowStart.getUTCDate() - 7);
    }
    const previousWindowEnd = currentWindowStart ? new Date(currentWindowStart) : null;
    if (previousWindowEnd) {
      previousWindowEnd.setUTCDate(previousWindowEnd.getUTCDate() - 1);
    }

    let totalStreams = 0;
    let totalRevenue = 0;
    let totalListeners = 0;
    let currentStreams = 0;
    let currentRevenue = 0;
    let currentListeners = 0;
    let previousStreams = 0;
    let previousRevenue = 0;
    const skipRates: number[] = [];
    const completionRates: number[] = [];
    const platformTotals = new Map<string, { streams: number; revenue: number; skipRates: number[] }>();

    metrics.forEach((metric) => {
      const streams = metric.daily_streams ?? 0;
      const revenue = metric.daily_revenue ?? 0;
      const listeners = metric.unique_listeners ?? 0;
      totalStreams += streams;
      totalRevenue += revenue;
      totalListeners += listeners;

      const metricDate = toDate(metric.analytics_date ?? null);
      if (metricDate && currentWindowStart && metricDate >= currentWindowStart) {
        currentStreams += streams;
        currentRevenue += revenue;
        currentListeners += listeners;
      } else if (
        metricDate &&
        previousWindowStart &&
        previousWindowEnd &&
        metricDate >= previousWindowStart &&
        metricDate <= previousWindowEnd
      ) {
        previousStreams += streams;
        previousRevenue += revenue;
      }

      if (typeof metric.skip_rate === "number") {
        skipRates.push(metric.skip_rate);
      }

      if (typeof metric.completion_rate === "number") {
        completionRates.push(metric.completion_rate);
      }

      const platformName = metric.platform_name ?? "Unknown platform";
      const platformEntry = platformTotals.get(platformName) ?? {
        streams: 0,
        revenue: 0,
        skipRates: [] as number[],
      };
      platformEntry.streams += streams;
      platformEntry.revenue += revenue;
      if (typeof metric.skip_rate === "number") {
        platformEntry.skipRates.push(metric.skip_rate);
      }
      platformTotals.set(platformName, platformEntry);
    });

    const avgSkipRate = skipRates.length
      ? skipRates.reduce((acc, rate) => acc + rate, 0) / skipRates.length
      : null;
    const avgCompletionRate = completionRates.length
      ? completionRates.reduce((acc, rate) => acc + rate, 0) / completionRates.length
      : null;

    const topPlatformEntry = Array.from(platformTotals.entries())
      .sort((a, b) => b[1].streams - a[1].streams)
      .shift();

    const topPlatform = topPlatformEntry
      ? {
          name: topPlatformEntry[0],
          streams: topPlatformEntry[1].streams,
          revenue: topPlatformEntry[1].revenue,
          avgSkipRate: topPlatformEntry[1].skipRates.length
            ? topPlatformEntry[1].skipRates.reduce((acc, rate) => acc + rate, 0) /
              topPlatformEntry[1].skipRates.length
            : null,
        }
      : undefined;

    return {
      releaseId: release.id,
      title: release.songs?.title ?? "Untitled track",
      genre: release.songs?.genre ?? null,
      totalStreams,
      totalRevenue,
      totalListeners,
      currentStreams,
      currentRevenue,
      currentListeners,
      previousStreams,
      previousRevenue,
      avgSkipRate,
      avgCompletionRate,
      topPlatform,
      latestDate,
    } satisfies ReleaseSummary;
  });
};

const buildInsightsFromSummaries = (
  summaries: ReleaseSummary[],
): AdvisorSuggestion[] => {
  const actionable: AdvisorSuggestion[] = [];
  const summariesWithData = summaries.filter((summary) => summary.totalStreams > 0);

  if (summariesWithData.length === 0) {
    return actionable;
  }

  const momentumCandidate = [...summariesWithData]
    .filter((summary) => summary.currentStreams > 0)
    .sort((a, b) => {
      const growthA = a.previousStreams > 0
        ? (a.currentStreams - a.previousStreams) / a.previousStreams
        : a.currentStreams > 0
          ? 1
          : 0;
      const growthB = b.previousStreams > 0
        ? (b.currentStreams - b.previousStreams) / b.previousStreams
        : b.currentStreams > 0
          ? 1
          : 0;
      return growthB - growthA;
    })
    .shift();

  if (momentumCandidate) {
    const growth = momentumCandidate.previousStreams > 0
      ? (momentumCandidate.currentStreams - momentumCandidate.previousStreams) /
        momentumCandidate.previousStreams
      : momentumCandidate.currentStreams > 0
        ? 1
        : 0;

    if (growth >= 0.1) {
      actionable.push({
        id: `momentum-${momentumCandidate.releaseId}`,
        title: `Momentum spike: ${momentumCandidate.title}`,
        message:
          "Your streaming momentum is accelerating. Double down with a coordinated push while the track is trending upward.",
        category: "momentum",
        metrics: [
          {
            label: "7-day streams",
            value: formatNumber(momentumCandidate.currentStreams),
            trend: "up",
          },
          {
            label: "Week-over-week",
            value: formatPercent(growth),
            trend: "up",
          },
          ...(momentumCandidate.topPlatform
            ? [
                {
                  label: `${momentumCandidate.topPlatform.name} share`,
                  value: formatPercent(
                    momentumCandidate.topPlatform.streams /
                      Math.max(momentumCandidate.totalStreams, 1),
                  ),
                  trend: "neutral" as const,
                },
              ]
            : []),
        ],
        actions: [
          { label: "Open streaming dashboard", href: "/streaming-platforms" },
          { label: "Plan a hype post", href: "/social" },
        ],
      });
    }
  }

  const decliningCandidate = [...summariesWithData]
    .filter((summary) => summary.previousStreams > 0)
    .sort((a, b) => {
      const growthA = (a.currentStreams - a.previousStreams) / a.previousStreams;
      const growthB = (b.currentStreams - b.previousStreams) / b.previousStreams;
      return growthA - growthB;
    })
    .shift();

  if (decliningCandidate) {
    const declineRate = (decliningCandidate.currentStreams - decliningCandidate.previousStreams) /
      decliningCandidate.previousStreams;

    if (declineRate <= -0.1) {
      actionable.push({
        id: `retention-${decliningCandidate.releaseId}`,
        title: `Regain listeners for ${decliningCandidate.title}`,
        message:
          "Streaming velocity dipped compared to last week. Re-engage fans with a live moment or exclusive drop to rebound quickly.",
        category: "retention",
        metrics: [
          {
            label: "7-day streams",
            value: formatNumber(decliningCandidate.currentStreams),
            trend: "down",
          },
          {
            label: "Change vs. last week",
            value: formatPercent(declineRate),
            trend: "down",
          },
        ],
        actions: [
          { label: "Book a spotlight gig", href: "/gigs" },
          { label: "Run a fan campaign", href: "/pr" },
        ],
      });
    }
  }

  const skipRiskCandidate = [...summariesWithData]
    .filter((summary) => (summary.avgSkipRate ?? 0) >= 0.35)
    .sort((a, b) => (b.avgSkipRate ?? 0) - (a.avgSkipRate ?? 0))
    .shift();

  if (skipRiskCandidate && skipRiskCandidate.avgSkipRate) {
    actionable.push({
      id: `skip-${skipRiskCandidate.releaseId}`,
      title: `Tackle skip rate on ${skipRiskCandidate.title}`,
      message:
        "Listeners are dropping early. Tighten the intro, update the arrangement, or tease a new version to boost completion.",
      category: "engagement",
      metrics: [
        {
          label: "Average skip rate",
          value: formatPercent(skipRiskCandidate.avgSkipRate),
          trend: "down",
        },
        ...(skipRiskCandidate.avgCompletionRate
          ? [
              {
                label: "Completion",
                value: formatPercent(skipRiskCandidate.avgCompletionRate),
                trend: "neutral" as const,
              },
            ]
          : []),
      ],
      actions: [
        { label: "Open recording studio", href: "/recording-studio" },
        { label: "Workshop songwriting", href: "/songwriting" },
      ],
    });
  }

  const platformTotals = summariesWithData.reduce(
    (acc, summary) => {
      if (!summary.topPlatform) return acc;
      const existing = acc.get(summary.topPlatform.name) ?? {
        streams: 0,
        revenue: 0,
        skipRates: [] as number[],
      };
      existing.streams += summary.topPlatform.streams;
      existing.revenue += summary.topPlatform.revenue;
      if (summary.topPlatform.avgSkipRate !== null) {
        existing.skipRates.push(summary.topPlatform.avgSkipRate);
      }
      acc.set(summary.topPlatform.name, existing);
      return acc;
    },
    new Map<string, { streams: number; revenue: number; skipRates: number[] }>(),
  );

  const leadingPlatformEntry = Array.from(platformTotals.entries())
    .sort((a, b) => b[1].streams - a[1].streams)
    .shift();

  if (leadingPlatformEntry) {
    const [name, payload] = leadingPlatformEntry;
    const skipRate = payload.skipRates.length
      ? payload.skipRates.reduce((acc, rate) => acc + rate, 0) / payload.skipRates.length
      : null;

    actionable.push({
      id: `platform-${name.toLowerCase().replace(/\s+/g, "-")}`,
      title: `${name} is your conversion engine`,
      message:
        "This platform is carrying the release cycle. Use platform-specific promos and pinned content to amplify the streak.",
      category: "monetization",
      metrics: [
        {
          label: "7-day streams",
          value: formatNumber(payload.streams),
          trend: "up",
        },
        ...(skipRate !== null
          ? [
              {
                label: "Skip rate",
                value: formatPercent(skipRate),
                trend: skipRate < 0.25 ? ("up" as const) : ("neutral" as const),
              },
            ]
          : []),
      ],
      actions: [
        { label: "Optimize platform strategy", href: "/streaming-platforms" },
        { label: "Sync social spotlight", href: "/social" },
      ],
    });
  }

  return actionable;
};

export const generateAdvisorInsights = async (
  userId: string,
): Promise<AdvisorInsights> => {
  const { data: releases, error: releasesError } = await supabase
    .from("song_releases")
    .select(
      `
        *,
        songs (
          title,
          genre
        )
      `,
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (releasesError) {
    throw new Error(releasesError.message ?? "Failed to load releases");
  }

  const typedReleases = (releases ?? []) as SongReleaseRow[];

  if (typedReleases.length === 0) {
    return {
      summary: DEFAULT_SUMMARY,
      suggestions: [
        {
          id: "setup-first-release",
          title: "Ship your first release",
          message:
            "Publish a track to unlock tailored insights. Once we detect analytics activity we can guide your promotion strategy.",
          category: "setup",
          metrics: [
            { label: "Releases with data", value: "0", trend: "neutral" },
          ],
          actions: [
            { label: "Open Music Hub", href: "/music" },
            { label: "Plan a release", href: "/release-manager" },
          ],
        },
      ],
    } satisfies AdvisorInsights;
  }

  const releaseIds = typedReleases.map((release) => release.id);

  if (releaseIds.length === 0) {
    return {
      summary: DEFAULT_SUMMARY,
      suggestions: [],
    } satisfies AdvisorInsights;
  }

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);
  const sinceDate = fourteenDaysAgo.toISOString().split("T")[0];

  const { data: analytics, error: analyticsError } = await supabase
    .from("streaming_analytics_daily")
    .select(
      `
        analytics_date,
        daily_streams,
        daily_revenue,
        platform_name,
        skip_rate,
        completion_rate,
        unique_listeners,
        song_release_id
      `,
    )
    .in("song_release_id", releaseIds)
    .gte("analytics_date", sinceDate);

  if (analyticsError) {
    throw new Error(analyticsError.message ?? "Failed to load analytics");
  }

  const typedAnalytics = (analytics ?? []) as StreamingDailyRow[];

  if (typedAnalytics.length === 0) {
    return {
      summary: DEFAULT_SUMMARY,
      suggestions: [
        {
          id: "sync-analytics",
          title: "Sync recent streaming data",
          message:
            "We didn’t detect fresh analytics for your releases. Trigger a metrics sync to power real-time recommendations.",
          category: "setup",
          metrics: [
            { label: "Last sync", value: "No recent data", trend: "neutral" },
          ],
          actions: [
            { label: "Open streaming dashboard", href: "/streaming-platforms" },
            { label: "Plan promo", href: "/pr" },
          ],
        },
      ],
    } satisfies AdvisorInsights;
  }

  const summaries = calculateReleaseSummaries(typedReleases, typedAnalytics);
  const suggestions = buildInsightsFromSummaries(summaries);

  const totalStreams7Days = summaries.reduce(
    (acc, summary) => acc + summary.currentStreams,
    0,
  );
  const totalRevenue7Days = summaries.reduce(
    (acc, summary) => acc + summary.currentRevenue,
    0,
  );
  const listenerReach7Days = summaries.reduce(
    (acc, summary) => acc + summary.currentListeners,
    0,
  );

  const latestDate = summaries.reduce<Date | null>((acc, summary) => {
    if (!summary.latestDate) return acc;
    if (!acc) return summary.latestDate;
    return summary.latestDate > acc ? summary.latestDate : acc;
  }, null);

  const momentumSummary = summaries
    .filter((summary) => summary.currentStreams > 0)
    .sort((a, b) => {
      const growthA = a.previousStreams > 0
        ? (a.currentStreams - a.previousStreams) / a.previousStreams
        : a.currentStreams > 0
          ? 1
          : 0;
      const growthB = b.previousStreams > 0
        ? (b.currentStreams - b.previousStreams) / b.previousStreams
        : b.currentStreams > 0
          ? 1
          : 0;
      return growthB - growthA;
    })
    .shift();

  const summaryPayload: AdvisorSummary = {
    totalStreams7Days,
    totalRevenue7Days,
    listenerReach7Days,
    updatedAt: latestDate ? latestDate.toISOString() : null,
    topMomentumTrack: momentumSummary
      ? {
          title: momentumSummary.title,
          growthRate:
            momentumSummary.previousStreams > 0
              ? (momentumSummary.currentStreams - momentumSummary.previousStreams) /
                momentumSummary.previousStreams
              : momentumSummary.currentStreams > 0
                ? 1
                : 0,
          currentStreams: momentumSummary.currentStreams,
        }
      : undefined,
  } satisfies AdvisorSummary;

  return {
    summary: summaryPayload,
    suggestions,
  } satisfies AdvisorInsights;
};
