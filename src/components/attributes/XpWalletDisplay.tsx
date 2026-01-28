import { Wallet, TrendingUp, Sparkles, Award, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface XpWalletDisplayProps {
  skillXpBalance: number;
  skillXpLifetime: number;
  attributePointsBalance: number;
  attributePointsSpent: number;
  activityBonusXp?: number;
  streak?: number;
}

export const XpWalletDisplay = ({
  skillXpBalance,
  skillXpLifetime,
  attributePointsBalance,
  attributePointsSpent,
  activityBonusXp = 0,
  streak = 0,
}: XpWalletDisplayProps) => {
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm cursor-help">
                    <Zap className="w-4 h-4 text-primary" />
                    <span>Skill XP</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Used to upgrade skills in the skill tree</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-2xl font-bold text-primary">{skillXpBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">SXP Available</p>
          </div>
          
          <div className="space-y-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm cursor-help">
                    <Award className="w-4 h-4 text-accent" />
                    <span>Attribute Points</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Used to increase core attributes like Looks, Charisma, etc.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-2xl font-bold text-accent">{attributePointsBalance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">AP Available</p>
          </div>

          <div className="space-y-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm cursor-help">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span>Yesterday's Bonus</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>XP earned from activities yesterday (auto-credited daily)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-2xl font-bold text-yellow-500">+{activityBonusXp.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Max 250/day</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Lifetime SXP</span>
            </div>
            <p className="text-2xl font-bold">{skillXpLifetime.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">
              AP Invested
            </div>
            <p className="text-2xl font-bold">{attributePointsSpent}</p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
