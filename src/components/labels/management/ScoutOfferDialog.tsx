import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Users, Star, Music, Send, Loader2 } from "lucide-react";
import {
  generateContractTerms,
  fetchBandMetrics,
} from "@/hooks/useContractOfferGeneration";

interface ScoutOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelId: string;
  labelReputation: number;
}

export function ScoutOfferDialog({ open, onOpenChange, labelId, labelReputation }: ScoutOfferDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch bands that are NOT already signed to this label
  const { data: bands = [], isLoading: loadingBands } = useQuery({
    queryKey: ["scout-bands", labelId, searchQuery],
    queryFn: async () => {
      // Get already-signed band IDs for this label
      const { data: existingContracts } = await supabase
        .from("artist_label_contracts")
        .select("band_id")
        .eq("label_id", labelId)
        .in("status", ["active", "offered"])
        .not("band_id", "is", null);

      const signedBandIds = (existingContracts ?? []).map(c => c.band_id).filter(Boolean);

      let query = supabase
        .from("bands")
        .select("id, name, genre, fame, total_fans, band_balance")
        .order("fame", { ascending: false })
        .limit(20);

      if (searchQuery.length >= 2) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      if (signedBandIds.length > 0) {
        query = query.not("id", "in", `(${signedBandIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Get the selected band's best song for the offer
  const { data: bestSong } = useQuery({
    queryKey: ["band-best-song", selectedBandId],
    queryFn: async () => {
      if (!selectedBandId) return null;
      const { data } = await supabase
        .from("songs")
        .select("id, title, quality_score, genre")
        .eq("band_id", selectedBandId)
        .eq("status", "recorded")
        .order("quality_score", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedBandId,
  });

  const offerDealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBandId) throw new Error("No band selected");

      const metrics = await fetchBandMetrics(selectedBandId);
      const songQuality = bestSong?.quality_score ?? 50;
      const terms = generateContractTerms(metrics, labelReputation, songQuality);

      // Get a deal type
      const { data: dealType } = await supabase
        .from("label_deal_types")
        .select("id")
        .limit(1)
        .single();

      if (!dealType) throw new Error("No deal types configured");

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + terms.term_months);

      const { error } = await supabase
        .from("artist_label_contracts")
        .insert({
          label_id: labelId,
          band_id: selectedBandId,
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
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-roster-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["scout-bands", labelId] });
      toast.success("Contract offer sent to the band!");
      setSelectedBandId(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to send offer: ${error.message}`);
    },
  });

  const selectedBand = bands.find(b => b.id === selectedBandId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Scout & Offer Deal
          </DialogTitle>
          <DialogDescription>
            Browse bands and offer them a record deal directly from your label.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bands by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-60 rounded-md border">
            <div className="p-2 space-y-2">
              {loadingBands ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading bands...</div>
              ) : bands.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No bands found
                </div>
              ) : (
                bands.map((band) => (
                  <button
                    key={band.id}
                    onClick={() => setSelectedBandId(band.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${
                      selectedBandId === band.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Music className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{band.name}</div>
                        <div className="text-xs text-muted-foreground">{band.genre}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {band.fame}
                      </span>
                      <span>{(band.total_fans ?? 0).toLocaleString()} fans</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedBand && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedBand.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBand.genre} · {selectedBand.fame} fame · {(selectedBand.total_fans ?? 0).toLocaleString()} fans
                    </p>
                  </div>
                  <Badge variant="secondary">Selected</Badge>
                </div>
                {bestSong && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Best recorded song: "{bestSong.title}" (quality: {bestSong.quality_score})
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => offerDealMutation.mutate()}
            disabled={!selectedBandId || offerDealMutation.isPending}
          >
            {offerDealMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
