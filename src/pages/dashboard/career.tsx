import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Award,
  BarChart3,
  Building2,
  CalendarClock,
  Loader2,
  MapPin,
  Mic,
  Music3,
  Star,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/dashboard/StatCard";
import { HighlightsList } from "@/components/dashboard/HighlightsList";
import {
  fetchCareerOverview,
  type CareerOverview,
  type CareerGigHighlight,
} from "@/lib/api/career";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatRating = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(1);
};

const formatReputation = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(1);
};

const formatDateSafely = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return format(date, "MMM d, yyyy");
};

const formatRelativeDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
};

const toTitleCase = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const getTopSkillLabel = (overview: CareerOverview | null) => {
  const topSkill = overview?.skillSummary.topSkills[0];
  if (!topSkill) {
    return { label: "—", value: 0 };
  }
  return {
    label: toTitleCase(topSkill.key),
    value: topSkill.value,
  };
};

const getBestGigLabel = (gig: CareerGigHighlight | null) => {
  if (!gig) {
    return "Build a show streak to unlock highlights.";
  }
  return `${formatDateSafely(gig.date)} · ${gig.venueName ?? "Unknown venue"}`;
};

const CareerDashboardPage = () => {
  const [overview, setOverview] = useState<CareerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error("You need to be logged in to view your career dashboard.");
        }

        const data = await fetchCareerOverview(user.id);
        if (active) {
          setOverview(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load career overview.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const topSkill = useMemo(() => getTopSkillLabel(overview), [overview]);
  const lastGigRelative = useMemo(
    () => formatRelativeDate(overview?.gigSummary?.lastGigDate),
    [overview?.gigSummary?.lastGigDate]
  );

  const topVenues = useMemo(
    () => (overview?.gigSummary?.venuePerformances ?? []).slice(0, 3),
    [overview?.gigSummary?.venuePerformances]
  );
  const topPromoters = useMemo(
    () => (overview?.gigSummary?.promoterPerformances ?? []).slice(0, 3),
    [overview?.gigSummary?.promoterPerformances]
  );
  const recentGigs = useMemo(
    () => overview?.gigSummary?.recentGigs ?? [],
    [overview?.gigSummary?.recentGigs]
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert variant="destructive">
          <AlertTitle>Unable to load career data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Career Overview</h1>
        <p className="text-muted-foreground">
          {overview?.band.name
            ? `${overview.band.name}'s performance, skills, and reputation at a glance.`
            : "Join or create a band to start building your performance history."}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Gigs Completed"
          value={overview?.gigSummary.totalGigs ?? 0}
          description={
            lastGigRelative
              ? `Last show ${lastGigRelative}`
              : "Play a gig to start your streak."
          }
          icon={<Trophy className="h-5 w-5" />}
        />
        <StatCard
          title="Average Gig Rating"
          value={formatRating(overview?.gigSummary.averageRating)}
          description={
            overview?.gigSummary.bestGig
              ? `Peak ${formatRating(overview.gigSummary.bestGig.rating)} at ${
                  overview.gigSummary.bestGig.venueName ?? "Unknown venue"
                }`
              : "Deliver unforgettable shows to unlock highlights."
          }
          icon={<Star className="h-5 w-5" />}
          trend={
            overview?.gigSummary.bestGig
              ? {
                  value: `Best ${formatRating(overview.gigSummary.bestGig.rating)}`,
                  direction: "up",
                  label: "career high",
                }
              : undefined
          }
        />
        <StatCard
          title="Lifetime Revenue"
          value={formatCurrency(overview?.gigSummary.totalRevenue ?? 0)}
          description="Ticketing and merch combined"
          icon={<BarChart3 className="h-5 w-5" />}
          trend={
            typeof overview?.gigSummary.totalNetProfit === "number"
              ? {
                  value: formatCurrency(overview.gigSummary.totalNetProfit),
                  direction: overview.gigSummary.totalNetProfit >= 0 ? "up" : "down",
                  label: "net profit",
                }
              : undefined
          }
        />
        <StatCard
          title="Band Fame"
          value={
            typeof overview?.reputationSummary.bandFame === "number"
              ? overview?.reputationSummary.bandFame
              : "—"
          }
          description={
            typeof overview?.band.popularity === "number"
              ? `Popularity ${overview.band.popularity}`
              : "Grow your following to boost fame."
          }
          icon={<Award className="h-5 w-5" />}
          trend={
            typeof overview?.band.weeklyFans === "number"
              ? {
                  value: `${overview.band.weeklyFans} fans/wk`,
                  direction: overview.band.weeklyFans >= 0 ? "up" : "down",
                  label: "weekly gain",
                }
              : undefined
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Top Skill"
          value={topSkill.label}
          description={`Level ${topSkill.value}`}
          icon={<Music3 className="h-5 w-5" />}
        />
        <StatCard
          title="Average Venue Reputation"
          value={formatReputation(overview?.gigSummary.averageVenueReputation)}
          description="Quality of stages you've played"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Average Promoter Reputation"
          value={formatReputation(overview?.gigSummary.averagePromoterReputation)}
          description="Strength of your booking network"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Career Highlight"
          value={overview?.gigSummary.bestGig ? formatRating(overview.gigSummary.bestGig.rating) : "—"}
          description={getBestGigLabel(overview?.gigSummary.bestGig ?? null)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </section>

      <Separator />

      <section className="grid gap-4 xl:grid-cols-3">
        <HighlightsList
          title="Signature Skills"
          description="Where your artistry currently shines the brightest."
          items={(overview?.skillSummary.topSkills ?? []).map(({ key, value }) => ({
            title: toTitleCase(key),
            value: value.toLocaleString(),
            description: "Training and practice invested",
            icon: <Mic className="h-4 w-4" />,
          }))}
          emptyMessage="Complete lessons, rehearsals, or gigs to grow your skill portfolio."
        />
        <HighlightsList
          title="Top Venues"
          description="Stages that consistently amplify your sound."
          items={topVenues.map(venue => ({
            title: venue.name,
            value: `${venue.shows} show${venue.shows === 1 ? "" : "s"}`,
            description: `Avg rating ${formatRating(venue.averageRating)} · Rep ${formatReputation(
              venue.averageReputation
            )}`,
            meta: `Revenue ${formatCurrency(venue.totalRevenue)}`,
            icon: <MapPin className="h-4 w-4" />,
          }))}
          emptyMessage="Land a gig to start building venue relationships."
        />
        <HighlightsList
          title="Recent Performances"
          description="A recap of the shows driving your reputation forward."
          items={recentGigs.map(gig => ({
            title: gig.venueName ?? "Unlisted venue",
            value: `Rating ${formatRating(gig.rating)}`,
            description: `${formatDateSafely(gig.date)} · ${formatCurrency(gig.revenue)}`,
            meta: gig.promoterName ? `Promoter ${gig.promoterName}` : undefined,
            icon: <CalendarClock className="h-4 w-4" />,
          }))}
          emptyMessage="Complete a gig to track how audiences respond."
        />
      </section>

      <section>
        <HighlightsList
          title="Promoter Network"
          description="Relationships influencing your booking opportunities."
          items={topPromoters.map(promoter => ({
            title: promoter.name,
            value: `${promoter.shows} booking${promoter.shows === 1 ? "" : "s"}`,
            description: `Avg reputation ${formatReputation(promoter.averageReputation)}`,
            icon: <Trophy className="h-4 w-4" />,
          }))}
          emptyMessage="Collaborate with promoters to grow your network."
        />
      </section>
    </div>
  );
};

export default CareerDashboardPage;
