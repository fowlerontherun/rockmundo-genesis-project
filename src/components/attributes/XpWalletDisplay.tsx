import { Wallet, TrendingUp, Sparkles, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface XpWalletDisplayProps {
  xpBalance: number;
  lifetimeXp: number;
  attributePointsAvailable: number;
  attributePointsSpent: number;
  activityBonusXp?: number;
}

export const XpWalletDisplay = ({
  xpBalance,
  lifetimeXp,
  attributePointsAvailable,
  attributePointsSpent,
  activityBonusXp = 0,
}: XpWalletDisplayProps) => {
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="w-4 h-4" />
              <span>XP Balance</span>
            </div>
            <p className="text-2xl font-bold text-primary">{xpBalance.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm cursor-help">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span>Activity Bonus</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>XP earned from activities like busking, mentors, exercise, and more</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-2xl font-bold text-yellow-500">+{activityBonusXp.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Lifetime XP</span>
            </div>
            <p className="text-2xl font-bold">{lifetimeXp.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Award className="w-4 h-4" />
              <span>Attribute Points</span>
            </div>
            <p className="text-2xl font-bold text-accent">{attributePointsAvailable}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">
              Points Spent
            </div>
            <p className="text-2xl font-bold">{attributePointsSpent}</p>
            <p className="text-xs text-muted-foreground">Total Invested</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
