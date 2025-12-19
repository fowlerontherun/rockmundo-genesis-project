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
import { useToast } from "@/components/ui/use-toast";
import { Scale, Crown, Check, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface HireLawyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentBalance: number;
  hasActiveLawyer: boolean;
}

const LAWYER_COST = 50000; // $50,000 to hire a lawyer

export function HireLawyerDialog({ 
  open, 
  onOpenChange, 
  userId, 
  currentBalance,
  hasActiveLawyer 
}: HireLawyerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canAfford = currentBalance >= LAWYER_COST;

  const hireLawyerMutation = useMutation({
    mutationFn: async () => {
      // Get profile ID from user ID
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile) throw new Error("Could not find profile");
      if (profile.cash < LAWYER_COST) throw new Error("Insufficient funds");

      // Deduct cost and activate lawyer
      const { error } = await supabase
        .from("profiles")
        .update({
          cash: profile.cash - LAWYER_COST,
          has_active_lawyer: true,
          lawyer_hired_at: new Date().toISOString(),
          lawyer_expires_at: null, // Permanent until contract signed
        })
        .eq("id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Lawyer hired!",
        description: "Your lawyer will negotiate better terms on your next label contract offer.",
      });
      queryClient.invalidateQueries({ queryKey: ["artist-entities"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to hire lawyer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400">
              <Scale className="h-5 w-5 text-amber-900" />
            </div>
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              Hire Entertainment Lawyer
            </span>
            <Crown className="h-4 w-4 text-amber-400" />
          </DialogTitle>
          <DialogDescription>
            VIP exclusive feature - Get better contract terms when labels make you an offer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasActiveLawyer ? (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Check className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-semibold text-green-400">Lawyer Active</p>
                    <p className="text-sm text-muted-foreground">
                      Your lawyer will negotiate your next contract offer.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-amber-300">Lawyer Benefits:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-400" />
                      <span>+5-10% better royalty rates</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-400" />
                      <span>+20-50% higher advance payment</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-400" />
                      <span>Better contract terms overall</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-amber-400" />
                      <span>One-time fee, applies to next offer</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cost:</span>
                    </div>
                    <span className="text-xl font-bold text-amber-400">
                      ${LAWYER_COST.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">Your balance:</span>
                    <span className={cn(
                      "font-semibold",
                      canAfford ? "text-green-400" : "text-destructive"
                    )}>
                      ${currentBalance.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {hasActiveLawyer ? "Close" : "Cancel"}
          </Button>
          {!hasActiveLawyer && (
            <Button
              onClick={() => hireLawyerMutation.mutate()}
              disabled={!canAfford || hireLawyerMutation.isPending}
              className={cn(
                "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600",
                "text-amber-950 font-semibold"
              )}
            >
              {hireLawyerMutation.isPending ? "Hiring..." : "Hire Lawyer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
