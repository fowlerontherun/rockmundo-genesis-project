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

    setIsSubmitting(true);
    const { error } = await supabase.from("label_promotion_campaigns").insert({
      release_id: release.id,
      campaign_type: campaignType.trim() || "Campaign",
      budget,
      start_date: startDate || null,
      end_date: endDate || null,
      channels: channels
        .split(",")
        .map((channel) => channel.trim())
        .filter(Boolean),
      notes: notes.trim() || null,
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
      title: "Promotion campaign added",
      description: "Your release campaign has been scheduled.",
    });

    await queryClient.invalidateQueries({ queryKey: ["label-releases"] });

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
          <DialogTitle>Schedule a promotion campaign</DialogTitle>
          <DialogDescription>
            Allocate budget and set your marketing window to support {release?.title ?? "this release"}.
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
              <Label htmlFor="campaign-budget">Budget</Label>
              <Input
                id="campaign-budget"
                type="number"
                min={0}
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value) || 0)}
              />
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Scheduling..." : "Schedule campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
