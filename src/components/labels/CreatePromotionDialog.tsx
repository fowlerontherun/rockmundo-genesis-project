import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { ReleaseWithRelations } from "./types";

interface CreatePromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: ReleaseWithRelations | null;
}

const DEFAULT_CHANNELS = "Streaming, Radio, Social";

export function CreatePromotionDialog({ open, onOpenChange, release }: CreatePromotionDialogProps) {
  const [campaignType, setCampaignType] = useState("Launch");
  const [budget, setBudget] = useState<number>(2500);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resetState = () => {
    setCampaignType("Launch");
    setBudget(2500);
    setStartDate("");
    setEndDate("");
    setChannels(DEFAULT_CHANNELS);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!release) {
      toast({
        title: "No release selected",
        description: "Select a release before adding a promotion campaign.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      toast({
        title: "Invalid promotion budget",
        description: "Enter a campaign budget greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      toast({
        title: "Invalid campaign dates",
        description: "The campaign end date cannot be before its start date.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const channelList = channels
      .split(",")
      .map((channel) => channel.trim())
      .filter(Boolean);

    const { error } = await (supabase as any).rpc("create_label_promotion_campaign", {
      p_release_id: release.id,
      p_campaign_type: campaignType.trim() || "Campaign",
      p_budget: Math.round(budget),
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_channels: channelList,
      p_notes: notes.trim() || null,
    });

    if (error) {
      toast({
        title: "Unable to schedule campaign",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "Promotion campaign funded",
      description: `$${Math.round(budget).toLocaleString()} has been charged to the label. The campaign will build release hype during its scheduled window.`,
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["label-releases"] }),
      queryClient.invalidateQueries({ queryKey: ["label-management"] }),
      queryClient.invalidateQueries({ queryKey: ["label-finances"] }),
    ]);

    setIsSubmitting(false);
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          resetState();
        }
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fund a promotion campaign</DialogTitle>
          <DialogDescription>
            Campaign budget is charged to the label when you confirm it. Active campaign spend builds release hype, increasing sales and streaming demand. Marketing department upgrades improve the impact of the same budget.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-type">Campaign type</Label>
              <Input
                id="campaign-type"
                value={campaignType}
                onChange={(event) => setCampaignType(event.target.value)}
                placeholder="Launch Blitz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-budget">Campaign budget</Label>
              <Input
                id="campaign-budget"
                type="number"
                min={1}
                step={100}
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Charged immediately when the campaign is funded.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-channels">Channels</Label>
            <Input
              id="campaign-channels"
              value={channels}
              onChange={(event) => setChannels(event.target.value)}
              placeholder="Streaming, Radio, Social"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-notes">Notes</Label>
            <Textarea
              id="campaign-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Outline KPI targets, teaser deliverables, or cross-promo partnerships."
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || budget <= 0}>
            {isSubmitting ? "Funding..." : `Fund $${Math.max(0, Math.round(budget)).toLocaleString()} Campaign`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}