import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, DollarSign, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RequestReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  labelName: string;
  terminationFeePct: number;
  contractValue: number;
  bandId: string | null;
  profileId: string;
}

export function RequestReleaseDialog({
  open,
  onOpenChange,
  contractId,
  labelName,
  terminationFeePct,
  contractValue,
  bandId,
  profileId,
}: RequestReleaseDialogProps) {
  const queryClient = useQueryClient();

  const terminationFee = Math.round((contractValue || 0) * ((terminationFeePct || 50) / 100));

  const { data: canAfford } = useQuery({
    queryKey: ["can-afford-termination", bandId, profileId, terminationFee],
    queryFn: async () => {
      if (bandId) {
        const { data } = await supabase.from("bands").select("band_balance").eq("id", bandId).single();
        return (data?.band_balance || 0) >= terminationFee;
      }
      const { data } = await supabase.from("profiles").select("cash").eq("id", profileId).single();
      return (data?.cash || 0) >= terminationFee;
    },
    enabled: open,
  });

  const requestReleaseMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("terminate_artist_contract_atomic", {
        p_contract_id: contractId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["active-label-contract"] });
      queryClient.invalidateQueries({ queryKey: ["my-labels"] });
      toast.success("Contract terminated. You are now a free agent.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Request Early Release
          </DialogTitle>
          <DialogDescription>
            Terminate your contract with {labelName} early
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Early termination requires paying a <strong>{terminationFeePct}%</strong> fee 
              of your contract value.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border text-center">
              <p className="text-xs text-muted-foreground">Contract Value</p>
              <p className="text-lg font-bold">${contractValue.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-center">
              <p className="text-xs text-destructive">Termination Fee</p>
              <p className="text-lg font-bold text-destructive">${terminationFee.toLocaleString()}</p>
            </div>
          </div>

          {canAfford === false && (
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                You don't have enough funds to pay the termination fee.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• The termination fee will be paid to the label</p>
            <p>• All future royalty obligations will cease</p>
            <p>• You'll be free to sign with another label</p>
            <p>• Existing releases under this contract remain under the label</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canAfford || requestReleaseMutation.isPending}
            onClick={() => requestReleaseMutation.mutate()}
          >
            {requestReleaseMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-1" />
            )}
            Pay ${terminationFee.toLocaleString()} & Terminate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
