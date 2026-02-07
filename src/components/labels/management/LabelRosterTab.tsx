import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, UserMinus, Music, Disc3, Album, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface LabelRosterTabProps {
  labelId: string;
  rosterCapacity: number;
}

export function LabelRosterTab({ labelId, rosterCapacity }: LabelRosterTabProps) {
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["label-roster-contracts", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          bands:band_id(id, name, genre, fame, total_fans),
          label_releases(id, status),
          label_royalty_statements(id, artist_share, label_share)
        `)
        .eq("label_id", labelId)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const dropArtistMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "terminated", terminated_at: new Date().toISOString() })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-roster-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-artists", labelId] });
      toast.success("Artist released from roster");
    },
    onError: () => toast.error("Failed to release artist"),
  });

  const activeContracts = contracts.filter(c => c.status === "active");

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading roster...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Signed Artists</h3>
          <p className="text-sm text-muted-foreground">
            {activeContracts.length} / {rosterCapacity} roster slots filled
          </p>
        </div>
        <Progress value={(activeContracts.length / rosterCapacity) * 100} className="w-32" />
      </div>

      {activeContracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No artists signed yet</p>
            <p className="text-sm text-muted-foreground">Review demo submissions to sign new artists</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeContracts.map((contract) => {
            const band = contract.bands as any;
            const releasesCount = contract.label_releases?.length ?? 0;
            const singlesCompleted = contract.singles_completed ?? 0;
            const albumsCompleted = contract.albums_completed ?? 0;
            const totalRoyalties = contract.label_royalty_statements?.reduce(
              (sum: number, s: any) => sum + (s.label_share ?? 0), 0
            ) ?? 0;

            return (
              <Card key={contract.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Music className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{band?.name || "Unknown Artist"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{band?.genre || "Various"}</span>
                          <span>·</span>
                          <span>{band?.fame ?? 0} fame</span>
                          <span>·</span>
                          <span>{(band?.total_fans ?? 0).toLocaleString()} fans</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => dropArtistMutation.mutate(contract.id)}
                      disabled={dropArtistMutation.isPending}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      Release
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Royalty Split</p>
                      <p className="font-semibold">{contract.royalty_artist_pct}% / {contract.royalty_label_pct ?? (100 - contract.royalty_artist_pct)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Disc3 className="h-3 w-3" />
                        <p className="text-xs text-muted-foreground">Singles</p>
                      </div>
                      <p className="font-semibold">{singlesCompleted}/{contract.single_quota ?? contract.release_quota ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Album className="h-3 w-3" />
                        <p className="text-xs text-muted-foreground">Albums</p>
                      </div>
                      <p className="font-semibold">{albumsCompleted}/{contract.album_quota ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                      <p className="font-semibold">${totalRoyalties.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline">{releasesCount} releases</Badge>
                    <Badge variant="secondary">
                      Advance: ${(contract.advance_amount ?? 0).toLocaleString()}
                    </Badge>
                    {contract.advance_amount && contract.recouped_amount !== null && (
                      <Badge variant={contract.recouped_amount >= contract.advance_amount ? "default" : "secondary"}>
                        {contract.recouped_amount >= contract.advance_amount ? "Recouped" : `${Math.round((contract.recouped_amount / contract.advance_amount) * 100)}% recouped`}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
