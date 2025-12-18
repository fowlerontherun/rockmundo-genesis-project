import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";

interface CancelReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: {
    id: string;
    title: string;
    total_cost?: number;
    band_id?: string | null;
    user_id?: string | null;
  } | null;
}

export function CancelReleaseDialog({ open, onOpenChange, release }: CancelReleaseDialogProps) {
  const queryClient = useQueryClient();

  const cancelRelease = useMutation({
    mutationFn: async () => {
      if (!release) throw new Error("No release selected");

      // Refund manufacturing cost to band balance if applicable
      if (release.band_id && release.total_cost && release.total_cost > 0) {
        const { data: band } = await supabase
          .from("bands")
          .select("band_balance")
          .eq("id", release.band_id)
          .single();

        if (band) {
          const newBalance = (band.band_balance || 0) + release.total_cost;
          await supabase
            .from("bands")
            .update({ band_balance: newBalance })
            .eq("id", release.band_id);

          // Record the refund
          await supabase.from("band_earnings").insert({
            band_id: release.band_id,
            amount: release.total_cost,
            source: "refund",
            description: `Release cancelled: ${release.title} (manufacturing refund)`,
          });
        }
      }

      // Update release status to cancelled
      const { error } = await supabase
        .from("releases")
        .update({ release_status: "cancelled" })
        .eq("id", release.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      toast({
        title: "Release Cancelled",
        description: release?.total_cost 
          ? `$${release.total_cost.toLocaleString()} has been refunded.`
          : "Release has been cancelled.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error cancelling release",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!release) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Release
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to cancel <strong>"{release.title}"</strong>?
            </p>
            {release.total_cost && release.total_cost > 0 && (
              <p className="text-sm bg-muted p-2 rounded">
                Manufacturing cost of <strong>${release.total_cost.toLocaleString()}</strong> will be refunded to your band balance.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All associated data will be marked as cancelled.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelRelease.isPending}>
            Keep Release
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              cancelRelease.mutate();
            }}
            disabled={cancelRelease.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cancelRelease.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Yes, Cancel Release"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
