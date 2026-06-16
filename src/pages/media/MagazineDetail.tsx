import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Users,
  Star,
  DollarSign,
  TrendingUp,
  Calendar,
  Send,
  CheckCircle,
  Globe,
} from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMPageSkeleton } from "@/components/fm/FMPageSkeleton";
import { useUserBand } from "@/hooks/useUserBand";
import { MediaSubmissionDialog } from "@/components/media/MediaSubmissionDialog";

interface MagazineRow {
  id: string;
  name: string;
  magazine_type: string | null;
  country: string | null;
  readership: number | null;
  quality_level: number | null;
  min_fame_required: number | null;
  genres: string[] | null;
  description: string | null;
  publication_frequency: string | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
}

const formatReadership = (n: number | null) => {
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

const MagazineDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: userBand } = useUserBand();
  const [submitOpen, setSubmitOpen] = useState(false);

  const { data: mag, isLoading } = useQuery({
    queryKey: ["magazine-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("magazines")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MagazineRow | null;
    },
  });

  const { data: existingSubmission } = useQuery({
    queryKey: ["magazine-submission", id, userBand?.id],
    enabled: !!id && !!userBand?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("magazine_submissions")
        .select("id, status")
        .eq("band_id", userBand!.id)
        .eq("magazine_id", id!)
        .in("status", ["pending", "approved", "scheduled"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <FMPageScaffold
        title="Magazine"
        subtitle="Loading details…"
        icon={BookOpen}
        backTo="/media/magazines"
        backLabel="Back to Magazines"
      >
        <FMPageSkeleton kpiCount={3} actionCount={1} bodyBlocks={2} />
      </FMPageScaffold>
    );
  }

  if (!mag) {
    return (
      <FMPageScaffold
        title="Magazine Not Found"
        subtitle="This publication is no longer available"
        icon={BookOpen}
        backTo="/media/magazines"
        backLabel="Back to Magazines"
      >
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>The requested magazine could not be loaded.</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const isEligible = !!userBand && (!mag.min_fame_required || userBand.fame >= mag.min_fame_required);
  const hasPending = !!existingSubmission;

  const headerActions = (
    <div className="flex items-center gap-2">
      {mag.magazine_type && (
        <Badge variant="outline" className="capitalize">
          {mag.magazine_type.replace(/_/g, " ")}
        </Badge>
      )}
      {mag.country && <Badge variant="secondary">{mag.country}</Badge>}
    </div>
  );

  return (
    <FMPageScaffold
      title={mag.name}
      subtitle={mag.magazine_type ? mag.magazine_type.replace(/_/g, " ") : "Magazine"}
      icon={BookOpen}
      backTo="/media/magazines"
      backLabel="Back to Magazines"
      headerActions={headerActions}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Readership
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatReadership(mag.readership)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" /> Minimum Fame
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {mag.min_fame_required ?? 0}
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
            {formatRange(mag.compensation_min, mag.compensation_max, "$")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {mag.fame_boost_min != null && (
              <div className="text-green-600">
                +{mag.fame_boost_min}-{mag.fame_boost_max} fame
              </div>
            )}
            {mag.fan_boost_min != null && (
              <div className="text-green-600">
                +{mag.fan_boost_min}-{mag.fan_boost_max} fans
              </div>
            )}
            {mag.fame_boost_min == null && mag.fan_boost_min == null && (
              <span className="text-muted-foreground">No declared boost</span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" /> Publication Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {mag.quality_level != null && (
              <Badge variant="outline">Quality {mag.quality_level}</Badge>
            )}
            {mag.publication_frequency && (
              <Badge variant="outline" className="capitalize">
                <Calendar className="h-3 w-3 mr-1" />
                {mag.publication_frequency}
              </Badge>
            )}
            {mag.genres?.map((g) => (
              <Badge key={g} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
          {mag.description ? (
            <p className="text-muted-foreground whitespace-pre-line">{mag.description}</p>
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
                {isEligible ? "Apply for Feature" : "Not Eligible"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {submitOpen && userBand && (
        <MediaSubmissionDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          mediaType="magazine"
          mediaItem={mag}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </FMPageScaffold>
  );
};

export default MagazineDetail;
