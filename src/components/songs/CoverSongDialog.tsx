import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
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
  const { user } = useAuth();
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
      if (!song || !paymentType || !user) throw new Error("Missing data");

      const skills = memberSkills || [];
      const { coverQuality, skillMultiplier } = calculateCoverQuality(song.quality_score, skills);
      const flatFee = paymentType === "flat_fee" ? calculateCoverFee(song.quality_score) : 0;

      if (paymentType === "flat_fee" && (bandBalance || 0) < flatFee) {
        throw new Error("Not enough funds");
      }

      // Fetch original song details for the cover
      const { data: originalSong } = await supabase
        .from("songs")
        .select("title, genre, duration_seconds, duration_display, lyrics")
        .eq("id", song.id)
        .single();

      if (!originalSong) throw new Error("Original song not found");

      // Deduct flat fee from band balance
      if (paymentType === "flat_fee" && flatFee > 0) {
        const { error: balanceError } = await supabase
          .from("bands")
          .update({ band_balance: (bandBalance || 0) - flatFee })
          .eq("id", bandId);
        if (balanceError) throw balanceError;

        // Record the earning for original band/artist
        if (song.band_id) {
          await supabase.from("band_earnings").insert({
            band_id: song.band_id,
            amount: flatFee,
            source: "cover_license",
            description: `Cover license fee for "${song.title}"`,
          });
        }
      }

      // Create the song_covers record
      const { error } = await supabase.from("song_covers").insert({
        original_song_id: song.id,
        covering_band_id: bandId,
        original_band_id: song.band_id,
        original_user_id: song.user_id,
        payment_type: paymentType,
        flat_fee_amount: flatFee,
        royalty_percentage: paymentType === "royalty_split" ? 50 : 0,
        cover_quality: coverQuality,
        skill_multiplier: skillMultiplier,
      });

      if (error) throw error;

      // Create a new song record in the covering band's repertoire
      const { error: songError } = await supabase.from("songs").insert({
        title: `${originalSong.title} (Cover)`,
        genre: originalSong.genre,
        quality_score: coverQuality,
        duration_seconds: originalSong.duration_seconds,
        duration_display: originalSong.duration_display,
        lyrics: originalSong.lyrics,
        band_id: bandId,
        user_id: user.id,
        parent_song_id: song.id,
        ownership_type: "cover",
        version: "cover",
        status: "recorded",
        added_to_repertoire_at: new Date().toISOString(),
        added_to_repertoire_by: user.id,
      });

      if (songError) throw songError;
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
