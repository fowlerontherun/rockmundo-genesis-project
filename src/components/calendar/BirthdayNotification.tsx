import { useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { claimBirthdayReward, calculateInGameAge } from "@/utils/gameCalendar";
import { useQueryClient } from "@tanstack/react-query";
import type { InGameDate } from "@/utils/gameCalendar";

interface BirthdayNotificationProps {
  userId: string;
  profileId: string;
  gameYear: number;
  birthDate: Date;
  createdAt: Date;
  inGameDate: InGameDate;
}

export function BirthdayNotification({
  userId,
  profileId,
  gameYear,
  birthDate,
  createdAt,
  inGameDate,
}: BirthdayNotificationProps) {
  const [claiming, setClaiming] = useState(false);
  const queryClient = useQueryClient();

  const age = calculateInGameAge(birthDate, createdAt, inGameDate);

  const handleClaim = async () => {
    setClaiming(true);
    const result = await claimBirthdayReward(userId, profileId, gameYear);
    
    if (result.success) {
      toast({
        title: "🎂 Birthday Rewards Claimed!",
        description: "You received 250 XP and 500 cash!",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["birthday-check"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["experience-ledger"] });
    } else {
      toast({
        title: "Failed to Claim",
        description: result.error || "Something went wrong",
        variant: "destructive",
      });
    }
    
    setClaiming(false);
  };

  return (
    <Card className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50 animate-in slide-in-from-top">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🎂</div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                Happy Birthday!
                <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
              </h3>
              <p className="text-sm text-muted-foreground">
                You turned {age} today in-game!
              </p>
              <p className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Claim: 250 XP + 500 Cash
              </p>
            </div>
          </div>
          <Button
            onClick={handleClaim}
            disabled={claiming}
            className="whitespace-nowrap"
          >
            {claiming ? "Claiming..." : "Claim Rewards"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
