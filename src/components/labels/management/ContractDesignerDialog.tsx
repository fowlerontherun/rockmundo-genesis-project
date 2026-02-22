import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileText, DollarSign, Send, Loader2 } from "lucide-react";
import {
  generateContractTerms,
  fetchBandMetrics,
} from "@/hooks/useContractOfferGeneration";

const ALL_TERRITORIES = ["NA", "EU", "UK", "ASIA", "LATAM", "OCEANIA"];

interface ContractDesignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelId: string;
  labelReputation: number;
  bandId?: string | null;
  bandName?: string;
  bandGenre?: string;
  bandFame?: number;
  bandFans?: number;
  songQuality?: number;
  demoSubmissionId?: string | null;
  artistProfileId?: string | null;
  onSuccess?: () => void;
}

export function ContractDesignerDialog({
  open,
  onOpenChange,
  labelId,
  labelReputation,
  bandId,
  bandName = "Unknown Artist",
  bandGenre = "Various",
  bandFame = 0,
  bandFans = 0,
  songQuality = 50,
  demoSubmissionId,
  artistProfileId,
  onSuccess,
}: ContractDesignerDialogProps) {
  const queryClient = useQueryClient();

  const [advance, setAdvance] = useState(5000);
  const [artistRoyalty, setArtistRoyalty] = useState(20);
  const [singleQuota, setSingleQuota] = useState(3);
  const [albumQuota, setAlbumQuota] = useState(1);
  const [termMonths, setTermMonths] = useState(24);
  const [terminationFee, setTerminationFee] = useState(40);
  const [manufacturingCovered, setManufacturingCovered] = useState(true);
  const [territories, setTerritories] = useState<string[]>(["NA"]);
  const [loaded, setLoaded] = useState(false);

  // Load suggested terms when dialog opens
  useEffect(() => {
    if (!open || loaded) return;

    const loadDefaults = async () => {
      try {
        const metrics = bandId
          ? await fetchBandMetrics(bandId)
          : { fame: bandFame, total_fans: bandFans, release_count: 0 };

        const terms = generateContractTerms(metrics, labelReputation, songQuality);
        setAdvance(terms.advance_amount);
        setArtistRoyalty(terms.royalty_artist_pct);
        setSingleQuota(terms.single_quota);
        setAlbumQuota(terms.album_quota);
        setTermMonths(terms.term_months);
        setTerminationFee(terms.termination_fee_pct);
        setManufacturingCovered(terms.manufacturing_covered);
        setTerritories(terms.territories);
        setLoaded(true);
      } catch (e) {
        console.error("Failed to load contract defaults", e);
        setLoaded(true);
      }
    };
    loadDefaults();
  }, [open, loaded, bandId, bandFame, bandFans, labelReputation, songQuality]);

  // Reset loaded state when dialog closes
  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  const toggleTerritory = (t: string) => {
    setTerritories((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const contractValue =
    advance + singleQuota * 5000 + albumQuota * 25000;

  const sendOfferMutation = useMutation({
    mutationFn: async () => {
      const { data: dealType } = await supabase
        .from("label_deal_types")
        .select("id")
        .limit(1)
        .single();

      if (!dealType) throw new Error("No deal types configured");

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + termMonths);

      const insertData: any = {
        label_id: labelId,
        deal_type_id: dealType.id,
        status: "offered",
        advance_amount: advance,
        royalty_artist_pct: artistRoyalty,
        royalty_label_pct: 100 - artistRoyalty,
        single_quota: singleQuota,
        album_quota: albumQuota,
        release_quota: singleQuota + albumQuota,
        termination_fee_pct: terminationFee,
        manufacturing_covered: manufacturingCovered,
        territories,
        contract_value: contractValue,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };

      if (bandId) insertData.band_id = bandId;
      if (artistProfileId) insertData.artist_profile_id = artistProfileId;
      if (demoSubmissionId) insertData.demo_submission_id = demoSubmissionId;

      const { data: contract, error } = await supabase
        .from("artist_label_contracts")
        .insert(insertData)
        .select("id")
        .single();

      if (error) throw error;

      // If from a demo, update the demo status
      if (demoSubmissionId) {
        await supabase
          .from("demo_submissions")
          .update({
            status: "accepted",
            reviewed_at: new Date().toISOString(),
            contract_offer_id: contract.id,
          })
          .eq("id", demoSubmissionId);
      }

      // Inbox notification is now handled automatically by the
      // notify_new_contract_offer() database trigger on insert.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-all-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["label-roster-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["scout-bands"] });
      queryClient.invalidateQueries({ queryKey: ["label-management-demos"] });
      queryClient.invalidateQueries({ queryKey: ["label-pending-contract-count"] });
      toast.success(`Contract offer sent to ${bandName}!`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to send offer: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Design Contract Offer
          </DialogTitle>
          <DialogDescription>
            Customize the terms before sending to{" "}
            <span className="font-semibold text-foreground">{bandName}</span>{" "}
            <span className="text-xs">({bandGenre})</span>
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Calculating suggested terms...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Advance */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Advance Amount
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={advance}
                  onChange={(e) => setAdvance(Math.max(0, Number(e.target.value)))}
                  className="w-32"
                />
                <Slider
                  value={[advance]}
                  onValueChange={([v]) => setAdvance(v)}
                  min={0}
                  max={500000}
                  step={1000}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                ${advance.toLocaleString()} upfront payment to the artist
              </p>
            </div>

            {/* Royalty Split */}
            <div className="space-y-2">
              <Label>Royalty Split (Artist / Label)</Label>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold w-20">
                  {artistRoyalty}% / {100 - artistRoyalty}%
                </span>
                <Slider
                  value={[artistRoyalty]}
                  onValueChange={([v]) => setArtistRoyalty(v)}
                  min={5}
                  max={60}
                  step={1}
                  className="flex-1"
                />
              </div>
            </div>

            <Separator />

            {/* Quotas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Single Quota</Label>
                <Input
                  type="number"
                  value={singleQuota}
                  onChange={(e) => setSingleQuota(Math.max(0, Number(e.target.value)))}
                  min={0}
                  max={20}
                />
              </div>
              <div className="space-y-1">
                <Label>Album Quota</Label>
                <Input
                  type="number"
                  value={albumQuota}
                  onChange={(e) => setAlbumQuota(Math.max(0, Number(e.target.value)))}
                  min={0}
                  max={10}
                />
              </div>
            </div>

            {/* Term & Termination */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Term (months)</Label>
                <Input
                  type="number"
                  value={termMonths}
                  onChange={(e) => setTermMonths(Math.max(6, Number(e.target.value)))}
                  min={6}
                  max={60}
                />
              </div>
              <div className="space-y-1">
                <Label>Termination Fee %</Label>
                <Input
                  type="number"
                  value={terminationFee}
                  onChange={(e) => setTerminationFee(Math.max(0, Math.min(100, Number(e.target.value))))}
                  min={0}
                  max={100}
                />
              </div>
            </div>

            {/* Manufacturing */}
            <div className="flex items-center justify-between">
              <Label>Manufacturing Covered</Label>
              <Switch
                checked={manufacturingCovered}
                onCheckedChange={setManufacturingCovered}
              />
            </div>

            <Separator />

            {/* Territories */}
            <div className="space-y-2">
              <Label>Territories</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_TERRITORIES.map((t) => (
                  <Badge
                    key={t}
                    variant={territories.includes(t) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTerritory(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Summary */}
            <Card>
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Estimated Contract Value
                  </span>
                  <span className="text-lg font-bold">
                    ${contractValue.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Advance ${advance.toLocaleString()} + {singleQuota} singles + {albumQuota} albums over {termMonths} months
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendOfferMutation.mutate()}
            disabled={sendOfferMutation.isPending || !loaded || territories.length === 0}
          >
            {sendOfferMutation.isPending ? (
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
