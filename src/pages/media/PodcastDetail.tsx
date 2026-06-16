import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Podcast,
  Headphones,
  Star,
  DollarSign,
  TrendingUp,
  Mic,
  Send,
  CheckCircle,
  Globe,
} from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMPageSkeleton } from "@/components/fm/FMPageSkeleton";
import { useUserBand } from "@/hooks/useUserBand";
import { MediaSubmissionDialog } from "@/components/media/MediaSubmissionDialog";
import { DEV_GUEST_BAND, getMockPodcastById, withDevPodcastFallback } from "@/dev/mockPodcasts";

interface PodcastRow {
  id: string;
  podcast_name: string;
  host_name: string | null;
  podcast_type: string | null;
  country: string | null;
  listener_base: number | null;
  episodes_per_week: number | null;
  min_fame_required: number | null;
  genres: string[] | null;
  description: string | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
}

const formatListeners = (n: number | null) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
};

const formatRange = (min: number | null, max: number | null, prefix = "") => {
  if (min == null && max == null) return "TBD";
  if (min != null && max != null) return `${prefix}${min} – ${prefix}${max}`;
  if (min != null) return `From ${prefix}${min}`;
  return `Up to ${prefix}${max}`;
};

const PodcastDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: userBandReal } = useUserBand();
  const userBand = userBandReal ?? (import.meta.env.DEV ? DEV_GUEST_BAND : undefined);
  const [submitOpen, setSubmitOpen] = useState(false);

  const { data: pod, isLoading } = useQuery({
    queryKey: ["podcast-detail", id],
    enabled: !!id,
    queryFn: () =>
      withDevPodcastFallback(
        async () => {
          const { data, error } = await supabase
            .from("podcasts")
            .select("*")
            .eq("id", id!)
            .maybeSingle();
          if (error) throw error;
          return data as unknown as PodcastRow | null;
        },
        () => getMockPodcastById(id) as PodcastRow | null,
      ),
  });

  const { data: existingSubmission } = useQuery({
    queryKey: ["podcast-submission", id, userBand?.id],
    enabled: !!id && !!userBand?.id && !!userBandReal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podcast_submissions")
        .select("id, status")
        .eq("band_id", userBand!.id)
        .eq("podcast_id", id!)
        .in("status", ["pending", "approved", "scheduled"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <FMPageScaffold
        title="Podcast"
        subtitle="Loading details…"
        icon={Podcast}
        backTo="/media/podcasts"
        backLabel="Back to Podcasts"
      >
        <FMPageSkeleton kpiCount={3} actionCount={1} bodyBlocks={2} />
      </FMPageScaffold>
    );
  }

  if (!pod) {
    return (
      <FMPageScaffold
        title="Podcast Not Found"
        subtitle="This show is no longer available"
        icon={Podcast}
        backTo="/media/podcasts"
        backLabel="Back to Podcasts"
      >
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Podcast className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>The requested podcast could not be loaded.</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const isEligible = !!userBand && (!pod.min_fame_required || userBand.fame >= pod.min_fame_required);
  const hasPending = !!existingSubmission;

  const headerActions = (
    <div className="flex items-center gap-2">
      {pod.podcast_type && (
        <Badge variant="outline" className="capitalize">
          {pod.podcast_type.replace(/_/g, " ")}
        </Badge>
      )}
      {pod.country && <Badge variant="secondary">{pod.country}</Badge>}
    </div>
  );

  return (
    <FMPageScaffold
      title={pod.podcast_name}
      subtitle={pod.host_name ? `Hosted by ${pod.host_name}` : "Podcast"}
      icon={Podcast}
      backTo="/media/podcasts"
      backLabel="Back to Podcasts"
      headerActions={headerActions}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Headphones className="h-4 w-4 text-muted-foreground" /> Listeners
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatListeners(pod.listener_base)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" /> Minimum Fame
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {pod.min_fame_required ?? 0}
            {userBand && (
              <span className="text-muted-foreground ml-2 text-xs">(you: {userBand.fame})</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> Compensation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {formatRange(pod.compensation_min, pod.compensation_max, "$")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {pod.fame_boost_min != null && (
              <div className="text-green-600">
                +{pod.fame_boost_min}-{pod.fame_boost_max} fame
              </div>
            )}
            {pod.fan_boost_min != null && (
              <div className="text-green-600">
                +{pod.fan_boost_min}-{pod.fan_boost_max} fans
              </div>
            )}
            {pod.fame_boost_min == null && pod.fan_boost_min == null && (
              <span className="text-muted-foreground">No declared boost</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" /> Show Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {pod.episodes_per_week != null && (
              <Badge variant="outline">
                <Mic className="h-3 w-3 mr-1" />
                {pod.episodes_per_week} eps/week
              </Badge>
            )}
            {pod.genres?.map((g) => (
              <Badge key={g} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
          {pod.description ? (
            <p className="text-muted-foreground whitespace-pre-line">{pod.description}</p>
          ) : (
            <p className="text-muted-foreground italic">No description provided.</p>
          )}

          <div className="pt-2">
            {hasPending ? (
              <Button variant="outline" disabled className="w-full">
                <CheckCircle className="mr-2 h-4 w-4" />
                Request Pending
              </Button>
            ) : (
              <Button
                variant={isEligible ? "default" : "outline"}
                className="w-full"
                disabled={!userBand || !isEligible}
                onClick={() => setSubmitOpen(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                {isEligible ? "Request Appearance" : "Not Eligible"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {submitOpen && userBand && (
        <MediaSubmissionDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          mediaType="podcast"
          mediaItem={{
            id: pod.id,
            name: pod.podcast_name,
            min_fame_required: pod.min_fame_required,
            genres: pod.genres,
            fame_boost_min: pod.fame_boost_min,
            fame_boost_max: pod.fame_boost_max,
            fan_boost_min: pod.fan_boost_min,
            fan_boost_max: pod.fan_boost_max,
            compensation_min: pod.compensation_min,
            compensation_max: pod.compensation_max,
          }}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </FMPageScaffold>
  );
};

export default PodcastDetail;
