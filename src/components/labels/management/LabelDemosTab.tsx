import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, CheckCircle2, XCircle, Clock, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ContractDesignerDialog } from "./ContractDesignerDialog";

interface LabelDemosTabProps {
  labelId: string;
  labelReputation: number;
  genreFocus: string[] | null;
  isPlayerOwned: boolean;
}

export function LabelDemosTab({ labelId, labelReputation, genreFocus, isPlayerOwned }: LabelDemosTabProps) {
  const queryClient = useQueryClient();
  const [designerDemo, setDesignerDemo] = useState<any>(null);

  const { data: demos = [], isLoading } = useQuery({
    queryKey: ["label-management-demos", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_submissions")
        .select(`
          *,
          bands:band_id(id, name, genre, fame, total_fans),
          songs:song_id(id, title, genre, quality_score)
        `)
        .eq("label_id", labelId)
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const rejectDemoMutation = useMutation({
    mutationFn: async ({ demoId, reason }: { demoId: string; reason: string }) => {
      const { error } = await supabase
        .from("demo_submissions")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", demoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-management-demos", labelId] });
      toast.success("Demo rejected");
    },
    onError: () => toast.error("Failed to reject demo"),
  });

  const pendingDemos = demos.filter(d => d.status === "pending");
  const reviewedDemos = demos.filter(d => d.status !== "pending");

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading demos...</CardContent></Card>;
  }

  const rejectionReasons = [
    "Not the right fit for our roster at this time.",
    "We're looking for a different sound direction.",
    "Great demo, but our A&R schedule is full.",
    "Keep developing your sound and resubmit later.",
  ];

  const demoBand = designerDemo?.bands as any;

  return (
    <>
      <div className="space-y-6">
        {/* Pending Demos */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Review ({pendingDemos.length})
          </h3>
          {pendingDemos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Music className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No pending demo submissions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingDemos.map((demo) => {
                const band = demo.bands as any;
                const song = demo.songs as any;
                const isGenreMatch = genreFocus?.some(
                  g => g.toLowerCase() === (song?.genre || "").toLowerCase()
                );

                return (
                  <Card key={demo.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{band?.name || "Solo Artist"}</p>
                            {band?.genre && <Badge variant="secondary">{band.genre}</Badge>}
                            {isGenreMatch && (
                              <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border-0">
                                Genre Match
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Demo: "{song?.title || "Untitled"}"
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500" />
                              Quality: {song?.quality_score ?? 0}
                            </span>
                            <span>{band?.fame ?? 0} fame</span>
                            <span>{(band?.total_fans ?? 0).toLocaleString()} fans</span>
                            <span>
                              {formatDistanceToNow(new Date(demo.submitted_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        {isPlayerOwned && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => setDesignerDemo(demo)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Accept & Offer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => rejectDemoMutation.mutate({
                                demoId: demo.id,
                                reason: rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)],
                              })}
                              disabled={rejectDemoMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Reviewed Demos */}
        {reviewedDemos.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Previously Reviewed</h3>
            <div className="space-y-2">
              {reviewedDemos.slice(0, 10).map((demo) => {
                const band = demo.bands as any;
                const song = demo.songs as any;

                return (
                  <div key={demo.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{band?.name || "Solo Artist"}</p>
                      <p className="text-sm text-muted-foreground">"{song?.title || "Untitled"}"</p>
                    </div>
                    <Badge variant={demo.status === "accepted" ? "default" : "destructive"}>
                      {demo.status === "accepted" ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" />Accepted</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" />Rejected</>
                      )}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {designerDemo && (
        <ContractDesignerDialog
          open={!!designerDemo}
          onOpenChange={(open) => { if (!open) setDesignerDemo(null); }}
          labelId={labelId}
          labelReputation={labelReputation}
          bandId={demoBand?.id}
          bandName={demoBand?.name || "Solo Artist"}
          bandGenre={demoBand?.genre}
          bandFame={demoBand?.fame ?? 0}
          bandFans={demoBand?.total_fans ?? 0}
          songQuality={(designerDemo.songs as any)?.quality_score ?? 50}
          demoSubmissionId={designerDemo.id}
          artistProfileId={designerDemo.artist_profile_id}
          onSuccess={() => setDesignerDemo(null)}
        />
      )}
    </>
  );
}
