import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, DollarSign, Disc3, Album, Clock } from "lucide-react";
import { differenceInMonths, parseISO } from "date-fns";

interface ContractDetails {
  id: string;
  label_name: string;
  advance_amount: number;
  recouped_amount: number;
  single_quota: number;
  album_quota: number;
  singles_completed: number;
  albums_completed: number;
  termination_fee_pct: number;
  contract_value: number;
  start_date: string;
  end_date: string;
  band_id?: string | null;
}

interface TerminateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractDetails;
  bandBalance?: number;
  userBalance?: number;
}

export function TerminateContractDialog({
  open,
  onOpenChange,
  contract,
  bandBalance = 0,
  userBalance = 0,
}: TerminateContractDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate termination details
  const now = new Date();
  const startDate = parseISO(contract.start_date);
  const endDate = parseISO(contract.end_date);
  const totalMonths = differenceInMonths(endDate, startDate);
  const elapsedMonths = differenceInMonths(now, startDate);
  const remainingMonths = Math.max(0, totalMonths - elapsedMonths);
  const progressPct = totalMonths > 0 ? ((elapsedMonths / totalMonths) * 100) : 0;

  // Calculate remaining contract value
  const singlesRemaining = Math.max(0, contract.single_quota - contract.singles_completed);
  const albumsRemaining = Math.max(0, contract.album_quota - contract.albums_completed);
  const remainingValue = (singlesRemaining * 5000) + (albumsRemaining * 25000);
  
  // Calculate termination fee
  const unrecoupedAdvance = Math.max(0, contract.advance_amount - contract.recouped_amount);
  const terminationFee = Math.round(
    (remainingValue * contract.termination_fee_pct / 100) + unrecoupedAdvance
  );

  const availableBalance = contract.band_id ? bandBalance : userBalance;
  const canAffordTermination = availableBalance >= terminationFee;

  const terminateMutation = useMutation({
    mutationFn: async () => {
      // Deduct fee from band or user balance
      if (contract.band_id) {
        const { data: band } = await supabase
          .from("bands")
          .select("band_balance")
          .eq("id", contract.band_id)
          .single();

        if (!band || (band.band_balance || 0) < terminationFee) {
          throw new Error("Insufficient band balance for termination fee");
        }

        await supabase
          .from("bands")
          .update({ band_balance: (band.band_balance || 0) - terminationFee })
          .eq("id", contract.band_id);

        // Record the expense
        await supabase.from("band_earnings").insert({
          band_id: contract.band_id,
          amount: -terminationFee,
          source: "contract_termination",
          description: `Contract termination fee: ${contract.label_name}`,
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", user.id)
          .single();

        if (!profile || (profile.cash || 0) < terminationFee) {
          throw new Error("Insufficient funds for termination fee");
        }

        await supabase
          .from("profiles")
          .update({ cash: (profile.cash || 0) - terminationFee })
          .eq("id", user.id);
      }

      // Update contract status
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({
          status: "terminated",
          terminated_at: new Date().toISOString(),
          termination_fee_paid: terminationFee,
        })
        .eq("id", contract.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Contract terminated",
        description: `You've paid $${terminationFee.toLocaleString()} to exit your contract with ${contract.label_name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["label-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["band"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Termination failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Terminate Contract
          </DialogTitle>
          <DialogDescription>
            Breaking your contract with {contract.label_name} will incur penalties.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract Progress */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Contract Progress
              </div>
              <Progress value={progressPct} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{elapsedMonths} months completed</span>
                <span>{remainingMonths} months remaining</span>
              </div>
            </CardContent>
          </Card>

          {/* Release Obligations */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-sm font-medium mb-2">Unfulfilled Obligations</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Disc3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {contract.singles_completed}/{contract.single_quota} singles
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Album className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {contract.albums_completed}/{contract.album_quota} albums
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fee Breakdown */}
          <Card className="border-destructive/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-destructive" />
                Termination Fee Breakdown
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unrecouped advance</span>
                  <span>${unrecoupedAdvance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Penalty ({contract.termination_fee_pct}% of remaining value)
                  </span>
                  <span>${Math.round(remainingValue * contract.termination_fee_pct / 100).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total Fee</span>
                  <span className="text-destructive">${terminationFee.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t">
                <span className="text-muted-foreground">Your balance</span>
                <span className={canAffordTermination ? "text-green-600" : "text-destructive"}>
                  ${availableBalance.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {!canAffordTermination && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="p-3 text-sm text-destructive">
                You don't have enough funds to pay the termination fee.
              </CardContent>
            </Card>
          )}

          {/* Confirmation */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="confirm-termination"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={!canAffordTermination}
            />
            <Label
              htmlFor="confirm-termination"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              I understand this action is permanent and will damage my relationship with {contract.label_name}.
            </Label>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Contract
          </Button>
          <Button
            variant="destructive"
            onClick={() => terminateMutation.mutate()}
            disabled={!confirmed || !canAffordTermination || terminateMutation.isPending}
          >
            {terminateMutation.isPending ? "Processing..." : `Pay $${terminationFee.toLocaleString()} & Terminate`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}