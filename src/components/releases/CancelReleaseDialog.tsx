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
    mutationFn: async (): Promise<{ refundedMajor: number; idempotent: boolean }> => {
      if (!release) throw new Error("No release selected");

      // The RPC locks the release, validates active-character ownership, checks
      // actual payer/charge records, and atomically updates status + any refund.
      // Do not write band_earnings or releases separately from this browser.
      const { data, error } = await (supabase as any).rpc("cancel_release_atomic", {
        p_release_id: release.id,
      });
      if (error) throw error;
      if (data?.success !== true) throw new Error("Release cancellation was not confirmed");
      const refundedMajor = Number(data.refundMajor ?? 0);
      if (!Number.isSafeInteger(refundedMajor) || refundedMajor < 0) {
        throw new Error("Release cancellation returned an invalid refund");
      }
      return { refundedMajor, idempotent: data.idempotent === true };
    },
    onSuccess: ({ refundedMajor, idempotent }) => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      toast({
        title: "Release Cancelled",
        description: idempotent
          ? "This release was already cancelled. No additional refund was issued."
          : refundedMajor > 0
            ? `$${refundedMajor.toLocaleString()} in verified band charges was refunded.`
            : "Release cancelled. No verified band refund was due.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Could not cancel release",
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
            <p className="text-sm bg-muted p-2 rounded">
              Refunds, where eligible, are calculated from verified band payment
              records. Cancellation is blocked when payment records are
              incomplete, the manufacturing has finished, or label-paid costs
              need separate reconciliation.
            </p>
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
