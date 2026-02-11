import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, CheckCircle2, XCircle, Clock, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  generateContractTerms,
  fetchBandMetrics,
  shouldAcceptDemo,
} from "@/hooks/useContractOfferGeneration";

interface LabelDemosTabProps {
  labelId: string;
  labelReputation: number;
  genreFocus: string[] | null;
  isPlayerOwned: boolean;
}

export function LabelDemosTab({ labelId, labelReputation, genreFocus, isPlayerOwned }: LabelDemosTabProps) {
  const queryClient = useQueryClient();

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

  const acceptDemoMutation = useMutation({
    mutationFn: async (demo: any) => {
      const bandId = demo.band_id;
      const songQuality = demo.songs?.quality_score ?? 50;

      // Fetch band metrics
      const metrics = bandId
        ? await fetchBandMetrics(bandId)
        : { fame: 0, total_fans: 0, release_count: 0 };

      // Generate contract terms
      const terms = generateContractTerms(metrics, labelReputation, songQuality);

      // Create contract offer
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + terms.term_months);

      // Get a global deal type (they are not label-specific)
      const { data: dealType } = await supabase.from("label_deal_types").select("id").limit(1).single();
      if (!dealType) throw new Error("No deal types configured in system");

      const { data: contract, error: contractError } = await supabase
        .from("artist_label_contracts")
        .insert({
          label_id: labelId,
          band_id: bandId || null,
          artist_profile_id: demo.artist_profile_id || null,
          deal_type_id: dealType.id,
          status: "offered",
          advance_amount: terms.advance_amount,
          royalty_artist_pct: terms.royalty_artist_pct,
          royalty_label_pct: terms.royalty_label_pct,
          single_quota: terms.single_quota,
          album_quota: terms.album_quota,
          release_quota: terms.single_quota + terms.album_quota,
          termination_fee_pct: terms.termination_fee_pct,
          manufacturing_covered: terms.manufacturing_covered,
          territories: terms.territories,
          contract_value: terms.contract_value,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          demo_submission_id: demo.id,
        })
        .select("id")
        .single();

      if (contractError) throw contractError;

      // Update demo status
      const { error: demoError } = await supabase
        .from("demo_submissions")
        .update({
          status: "accepted",
          reviewed_at: new Date().toISOString(),
          contract_offer_id: contract.id,
        })
        .eq("id", demo.id);

      if (demoError) throw demoError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-management-demos", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-roster-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-artists", labelId] });
      toast.success("Demo accepted! Contract offer sent to the artist.");
    },
    onError: (error: Error) => toast.error(`Failed to accept demo: ${error.message}`),
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

  return (
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
                            onClick={() => acceptDemoMutation.mutate(demo)}
                            disabled={acceptDemoMutation.isPending}
                          >
                            {acceptDemoMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                            )}
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
  );
}
