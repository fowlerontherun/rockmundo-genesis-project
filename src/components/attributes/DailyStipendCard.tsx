import { Gift, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { claimDailyXp } from "@/utils/progression";
import { toast } from "sonner";
import { format } from "date-fns";

interface DailyStipendCardProps {
  lastClaimDate?: string | null;
  onClaimed?: () => void;
}

export const DailyStipendCard = ({ lastClaimDate, onClaimed }: DailyStipendCardProps) => {
  const queryClient = useQueryClient();
  
  // Check if user has claimed today by comparing dates (not timestamps)
  const hasClaimedToday = lastClaimDate 
    ? format(new Date(lastClaimDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
    : false;

  const claimMutation = useMutation({
    mutationFn: claimDailyXp,
    onSuccess: () => {
      toast.success("Daily XP claimed successfully!");
      queryClient.invalidateQueries({ queryKey: ["gameData"] });
      onClaimed?.();
    },
    onError: (error: Error) => {
      // Don't show error toast if it's just the "already claimed" validation
      if (error.message?.includes("already claimed")) {
        toast.info("You've already claimed your daily XP today");
      } else {
        toast.error(error.message || "Failed to claim daily XP");
      }
    },
  });

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-accent" />
          Daily XP Stipend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Base Amount</p>
            <p className="text-2xl font-bold text-accent">100 XP</p>
          </div>
          {lastClaimDate && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Last Claimed</p>
              <div className="flex items-center gap-1 text-sm">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(lastClaimDate), "MMM d, yyyy")}</span>
              </div>
            </div>
          )}
        </div>
        
        <Button
          onClick={() => claimMutation.mutate({})}
          disabled={hasClaimedToday || claimMutation.isPending}
          className="w-full"
          size="lg"
        >
          {hasClaimedToday ? "Already Claimed Today" : "Claim Daily XP"}
        </Button>
      </CardContent>
    </Card>
  );
};
