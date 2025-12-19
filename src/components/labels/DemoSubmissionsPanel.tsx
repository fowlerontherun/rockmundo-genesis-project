import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DemoSubmissionsPanelProps {
  userId: string;
  bandId?: string | null;
}

interface DemoSubmission {
  id: string;
  song_id: string;
  label_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  songs: {
    title: string;
    genre: string;
    quality_score: number;
  } | null;
  labels: {
    name: string;
    reputation_score: number;
  } | null;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  under_review: { icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "default" },
  accepted: { icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" },
  rejected: { icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

export function DemoSubmissionsPanel({ userId, bandId }: DemoSubmissionsPanelProps) {
  const { data: submissions = [], isLoading } = useQuery<DemoSubmission[]>({
    queryKey: ["demo-submissions", userId, bandId],
    queryFn: async () => {
      let query = supabase
        .from("demo_submissions")
        .select(`
          id,
          song_id,
          label_id,
          status,
          submitted_at,
          reviewed_at,
          rejection_reason,
          songs(title, genre, quality_score),
          labels(name, reputation_score)
        `)
        .order("submitted_at", { ascending: false })
        .limit(10);

      if (bandId) {
        query = query.eq("band_id", bandId);
      } else {
        query = query.eq("artist_profile_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DemoSubmission[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          Loading submissions...
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Music className="h-4 w-4" />
          Demo Submissions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {submissions.map((submission) => {
              const statusConfig = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG.pending;

              return (
                <div
                  key={submission.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {submission.songs?.title ?? "Unknown Song"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      To: {submission.labels?.name ?? "Unknown Label"}
                    </div>
                    {submission.status === "rejected" && submission.rejection_reason && (
                      <p className="text-xs text-destructive mt-1 italic">
                        "{submission.rejection_reason}"
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Badge variant={statusConfig.variant} className="flex items-center gap-1 shrink-0">
                    {statusConfig.icon}
                    {submission.status.replace("_", " ")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}