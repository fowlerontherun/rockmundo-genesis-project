import { useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { claimBirthdayReward } from "@/utils/gameCalendar";
import { useQueryClient } from "@tanstack/react-query";
import type { InGameDate } from "@/utils/gameCalendar";

interface BirthdayNotificationProps {
  userId: string;
  profileId: string;
  gameYear: number;
  playerAge: number;
  inGameDate: InGameDate;
}

export function BirthdayNotification({
  userId,
  profileId,
  gameYear,
  playerAge,
  inGameDate,
}: BirthdayNotificationProps) {
  const [claiming, setClaiming] = useState(false);
  const queryClient = useQueryClient();
  const age = playerAge;
  const expectedSxp = Math.min(1000, 500 + age * 5);
  const expectedAp = Math.min(10, 5 + Math.floor(age / 20));

  const handleClaim = async () => {
    setClaiming(true);
    const result = await claimBirthdayReward(userId, profileId, gameYear, inGameDate);

    if (result.success) {
      toast({
        title: "🎂 Birthday rewards claimed!",
        description: `You received ${(result.sxp ?? expectedSxp).toLocaleString()} SXP and ${result.ap ?? expectedAp} AP.`,
      });

      queryClient.invalidateQueries({ queryKey: ["birthday-check"] });
      queryClient.invalidateQueries({ queryKey: ["birthday-state"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["player-xp-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["experience-ledger"] });
    } else {
      toast({
        title: "Failed to claim",
        description: result.error || "Something went wrong",
        variant: "destructive",
      });
    }

    setClaiming(false);
  };

  return (
    <Card className="animate-in border-yellow-500/50 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 slide-in-from-top">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🎂</div>
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                Happy Birthday!
                <Sparkles className="h-4 w-4 animate-pulse text-yellow-500" />
              </h3>
              <p className="text-sm text-muted-foreground">You turned {age} today in-game!</p>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Gift className="h-4 w-4" />
                Claim: {expectedSxp.toLocaleString()} SXP + {expectedAp} AP
              </p>
            </div>
          </div>
          <Button onClick={handleClaim} disabled={claiming} className="whitespace-nowrap">
            {claiming ? "Claiming..." : "Claim Rewards"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
