import { Wallet, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface XpWalletDisplayProps {
  xpBalance: number;
  lifetimeXp: number;
  attributePointsAvailable: number;
  attributePointsSpent: number;
}

export const XpWalletDisplay = ({
  xpBalance,
  lifetimeXp,
  attributePointsAvailable,
  attributePointsSpent,
}: XpWalletDisplayProps) => {
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="w-4 h-4" />
              <span>XP Balance</span>
            </div>
            <p className="text-2xl font-bold text-primary">{xpBalance.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Lifetime XP</span>
            </div>
            <p className="text-2xl font-bold">{lifetimeXp.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">
              Attribute Points
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
