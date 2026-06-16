import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Newspaper,
  Users,
  Star,
  DollarSign,
  TrendingUp,
  Globe,
  Send,
  CheckCircle,
} from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMPageSkeleton } from "@/components/fm/FMPageSkeleton";
import { useUserBand } from "@/hooks/useUserBand";
import { MediaSubmissionDialog } from "@/components/media/MediaSubmissionDialog";
import { useState } from "react";

interface NewspaperRow {
  id: string;
  name: string;
  newspaper_type: string | null;
  country: string | null;
  circulation: number | null;
  quality_level: number | null;
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

const formatCirculation = (circ: number | null) => {
  if (!circ) return "0";
  if (circ >= 1_000_000) return `${(circ / 1_000_000).toFixed(1)}M`;
  if (circ >= 1_000) return `${(circ / 1_000).toFixed(0)}K`;
  return circ.toString();
};

const formatRange = (min: number | null, max: number | null, prefix = "") => {
  if (min == null && max == null) return "TBD";
  if (min != null && max != null) return `${prefix}${min} – ${prefix}${max}`;
  if (min != null) return `From ${prefix}${min}`;
  return `Up to ${prefix}${max}`;
};

const NewspaperDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: userBand } = useUserBand();
  const [submitOpen, setSubmitOpen] = useState(false);

  const { data: paper, isLoading } = useQuery({
    queryKey: ["newspaper-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newspapers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as NewspaperRow | null;
    },
  });

  const { data: existingSubmission } = useQuery({
    queryKey: ["newspaper-submission", id, userBand?.id],
    enabled: !!id && !!userBand?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newspaper_submissions")
        .select("id, status")
        .eq("band_id", userBand!.id)
        .eq("newspaper_id", id!)
        .in("status", ["pending", "approved", "scheduled"])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <FMPageScaffold
        title="Newspaper"
        subtitle="Loading details…"
        icon={Newspaper}
        backTo="/media/newspapers"
        backLabel="Back to Newspapers"
      >
        <FMPageSkeleton kpiCount={3} actionCount={1} bodyBlocks={2} />
      </FMPageScaffold>
    );
  }

  if (!paper) {
    return (
      <FMPageScaffold
        title="Newspaper Not Found"
        subtitle="This publication is no longer available"
        icon={Newspaper}
        backTo="/media/newspapers"
        backLabel="Back to Newspapers"
      >
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>The requested newspaper could not be loaded.</p>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const isEligible = !!userBand && (!paper.min_fame_required || userBand.fame >= paper.min_fame_required);
  const hasPending = !!existingSubmission;

  const headerActions = (
    <div className="flex items-center gap-2">
      {paper.newspaper_type && (
        <Badge variant="outline" className="capitalize">
          {paper.newspaper_type.replace(/_/g, " ")}
        </Badge>
      )}
      {paper.country && <Badge variant="secondary">{paper.country}</Badge>}
    </div>
  );

  return (
    <FMPageScaffold
      title={paper.name}
      subtitle={paper.newspaper_type ? paper.newspaper_type.replace(/_/g, " ") : "Press publication"}
      icon={Newspaper}
      backTo="/media/newspapers"
      backLabel="Back to Newspapers"
      headerActions={headerActions}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Circulation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatCirculation(paper.circulation)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" /> Minimum Fame
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {paper.min_fame_required ?? 0}
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
            {formatRange(paper.compensation_min, paper.compensation_max, "$")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {paper.fame_boost_min != null && (
              <div className="text-green-600">
                +{paper.fame_boost_min}-{paper.fame_boost_max} fame
              </div>
            )}
            {paper.fan_boost_min != null && (
              <div className="text-green-600">
                +{paper.fan_boost_min}-{paper.fan_boost_max} fans
              </div>
            )}
            {paper.fame_boost_min == null && paper.fan_boost_min == null && (
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
            {paper.quality_level != null && (
              <Badge variant="outline">Quality {paper.quality_level}</Badge>
            )}
            {paper.genres?.map((g) => (
              <Badge key={g} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
          </div>
          {paper.description ? (
            <p className="text-muted-foreground whitespace-pre-line">{paper.description}</p>
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
                {isEligible ? "Request Interview" : "Not Eligible"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {submitOpen && userBand && (
        <MediaSubmissionDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          mediaType="newspaper"
          mediaItem={paper}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </FMPageScaffold>
  );
};

export default NewspaperDetail;
