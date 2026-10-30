import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Percent, Music, AlertTriangle, CheckCircle } from "lucide-react";
import { calculateCoverQuality, calculateCoverFee, getCoverQualityDescription } from "@/utils/coverQuality";
import { useToast } from "@/components/ui/use-toast";
import type { RankedSong } from "@/hooks/useSongRankings";

interface CoverSongDialogProps {
  song: RankedSong | null;
  bandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CoverSongDialog = ({ song, bandId, open, onOpenChange }: CoverSongDialogProps) => {
  const [paymentType, setPaymentType] = useState<"flat_fee" | "royalty_split" | null>(null);
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  // Fetch band member skills
  const { data: memberSkills } = useQuery({
    queryKey: ["band-member-skills", bandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("band_members")
        .select("skill_contribution")
        .eq("band_id", bandId);
      return (data || []).map(m => m.skill_contribution || 0);
    },
    enabled: open && !!bandId,
  });

  // Check if already covered
  const { data: existingCover } = useQuery({
    queryKey: ["existing-cover", song?.id, bandId],
    queryFn: async () => {
      if (!song) return null;
      const { data } = await supabase
        .from("song_covers")
        .select("id")
        .eq("original_song_id", song.id)
        .eq("covering_band_id", bandId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!song && !!bandId,
  });

  // Check band balance
  const { data: bandBalance } = useQuery({
    queryKey: ["band-balance-for-cover", bandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bands")
        .select("band_balance")
        .eq("id", bandId)
        .single();
      return data?.band_balance || 0;
    },
    enabled: open && !!bandId,
  });

  const coverMutation = useMutation({
    mutationFn: async () => {
      if (!song || !paymentType || !profileId) throw new Error("Missing data");

      // Authoritative RPC performs all license, fee, royalty credit and song
      // mutations in one transaction. The browser never chooses the payout
      // amount, band-earnings source, or final cover quality.
      const { data, error } = await (supabase as any).rpc("create_band_cover_license_atomic", {
        p_original_song_id: song.id,
        p_covering_band_id: bandId,
        p_profile_id: profileId,
        p_payment_type: paymentType,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Song covered!", description: `"${song?.title}" has been added to your band's repertoire. You can now rehearse or record it!` });
      queryClient.invalidateQueries({ queryKey: ["song-rankings"] });
      queryClient.invalidateQueries({ queryKey: ["existing-cover"] });
      queryClient.invalidateQueries({ queryKey: ["band-balance-for-cover"] });
      queryClient.invalidateQueries({ queryKey: ["band-songs"] });
      onOpenChange(false);
      setPaymentType(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  if (!song) return null;

  const skills = memberSkills || [];
  const { coverQuality, skillMultiplier } = calculateCoverQuality(song.quality_score, skills);
  const flatFee = calculateCoverFee(song.quality_score);
  const qualityDescription = getCoverQualityDescription(song.quality_score, skillMultiplier);
  const canAfford = (bandBalance || 0) >= flatFee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Cover: {song.title}
          </DialogTitle>
          <DialogDescription>
            By {song.band_name || song.artist_name || "Unknown"} • Quality: {song.quality_score}
          </DialogDescription>
        </DialogHeader>

        {existingCover ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-muted">
            <CheckCircle className="h-5 w-5 text-primary" />
            <p className="text-sm">Your band already covers this song!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cover Quality Preview */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Original Quality</span>
                  <Badge variant="outline">{song.quality_score}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Your Cover Quality</span>
                  <Badge className="bg-primary">{coverQuality}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Skill Multiplier</span>
                  <span className="text-sm font-mono">{Math.round(skillMultiplier * 100)}%</span>
                </div>
                <p className="text-xs text-muted-foreground italic">{qualityDescription}</p>
              </CardContent>
            </Card>

            {/* Payment Options */}
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`cursor-pointer transition-all border-2 ${paymentType === "flat_fee" ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20"}`}
                onClick={() => setPaymentType("flat_fee")}
              >
                <CardContent className="pt-4 text-center space-y-2">
                  <DollarSign className="h-8 w-8 mx-auto text-primary" />
                  <h4 className="font-semibold text-sm">Flat Fee</h4>
                  <p className="text-2xl font-bold">${flatFee.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">One-time payment. No royalties owed.</p>
                  {!canAfford && (
                    <div className="flex items-center gap-1 text-destructive text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      Not enough funds
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all border-2 ${paymentType === "royalty_split" ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20"}`}
                onClick={() => setPaymentType("royalty_split")}
              >
                <CardContent className="pt-4 text-center space-y-2">
                  <Percent className="h-8 w-8 mx-auto text-accent-foreground" />
                  <h4 className="font-semibold text-sm">Royalty Split</h4>
                  <p className="text-2xl font-bold">50%</p>
                  <p className="text-xs text-muted-foreground">No upfront cost. 50% of all cover revenue goes to the original artist.</p>
                </CardContent>
              </Card>
            </div>

            <Button
              className="w-full"
              disabled={!paymentType || (paymentType === "flat_fee" && !canAfford) || coverMutation.isPending}
              onClick={() => coverMutation.mutate()}
            >
              {coverMutation.isPending ? "Processing..." : "Confirm Cover License"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
