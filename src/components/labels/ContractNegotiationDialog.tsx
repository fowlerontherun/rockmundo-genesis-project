import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Percent, Clock, FileText, HandshakeIcon, XCircle } from "lucide-react";

interface ContractNegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: {
    id: string;
    label_id: string;
    band_id?: string;
    artist_profile_id?: string;
    deal_type_id: string;
    advance_amount: number;
    royalty_artist_pct: number;
    royalty_label_pct: number;
    release_quota: number;
    marketing_support: number;
    start_date: string;
    end_date: string;
    status: string;
    label?: {
      name: string;
      reputation_score: number;
    };
    deal_type?: {
      name: string;
    };
  } | null;
}

export const ContractNegotiationDialog = ({ open, onOpenChange, contract }: ContractNegotiationDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [counterOffer, setCounterOffer] = useState({
    advance_amount: contract?.advance_amount || 0,
    royalty_artist_pct: contract?.royalty_artist_pct || 50,
    release_quota: contract?.release_quota || 1,
    marketing_support: contract?.marketing_support || 0,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "active" })
        .eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast({ title: "Contract accepted!", description: "You're now signed to the label." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to accept", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "rejected" })
        .eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast({ title: "Contract rejected" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to reject", description: error.message, variant: "destructive" });
    },
  });

  const counterOfferMutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error("No contract");
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({
          advance_amount: counterOffer.advance_amount,
          royalty_artist_pct: counterOffer.royalty_artist_pct,
          royalty_label_pct: 100 - counterOffer.royalty_artist_pct,
          release_quota: counterOffer.release_quota,
          marketing_support: counterOffer.marketing_support,
          status: "negotiating",
        })
        .eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      toast({ title: "Counter-offer sent!", description: "Waiting for label response." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to send counter-offer", description: error.message, variant: "destructive" });
    },
  });

  if (!contract) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Negotiation
          </DialogTitle>
          <DialogDescription>
            Review and negotiate the terms with {contract.label?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Offer */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Current Offer</h3>
                <Badge>{contract.deal_type?.name || "Standard Deal"}</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Advance</p>
                  <p className="text-lg font-bold">{formatCurrency(contract.advance_amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Your Royalty</p>
                  <p className="text-lg font-bold">{contract.royalty_artist_pct}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Release Quota</p>
                  <p className="text-lg font-bold">{contract.release_quota} releases</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Marketing Support</p>
                  <p className="text-lg font-bold">{formatCurrency(contract.marketing_support)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Counter-Offer Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Make a Counter-Offer</h3>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Advance Amount
              </Label>
              <Input
                type="number"
                value={counterOffer.advance_amount}
                onChange={(e) => setCounterOffer(prev => ({ ...prev, advance_amount: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4" /> Artist Royalty: {counterOffer.royalty_artist_pct}%
              </Label>
              <Slider
                value={[counterOffer.royalty_artist_pct]}
                onValueChange={([v]) => setCounterOffer(prev => ({ ...prev, royalty_artist_pct: v }))}
                min={10}
                max={90}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Label gets {100 - counterOffer.royalty_artist_pct}%
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Release Quota
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={counterOffer.release_quota}
                  onChange={(e) => setCounterOffer(prev => ({ ...prev, release_quota: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Marketing Support
                </Label>
                <Input
                  type="number"
                  value={counterOffer.marketing_support}
                  onChange={(e) => setCounterOffer(prev => ({ ...prev, marketing_support: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="flex-1"
            >
              <HandshakeIcon className="h-4 w-4 mr-2" />
              Accept Original
            </Button>
            <Button
              onClick={() => counterOfferMutation.mutate()}
              disabled={counterOfferMutation.isPending}
              variant="secondary"
              className="flex-1"
            >
              Send Counter-Offer
            </Button>
            <Button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              variant="destructive"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
