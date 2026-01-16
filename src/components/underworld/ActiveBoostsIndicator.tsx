import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, TrendingUp, Zap, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ActiveBoost } from "@/hooks/useUnderworldStore";

const boostIcons: Record<string, React.ReactNode> = {
  xp_multiplier: <TrendingUp className="h-4 w-4" />,
  fame_multiplier: <Star className="h-4 w-4" />,
  energy_regen: <Zap className="h-4 w-4" />,
  all_multiplier: <Sparkles className="h-4 w-4" />,
};

const boostLabels: Record<string, string> = {
  xp_multiplier: "XP Boost",
  fame_multiplier: "Fame Boost",
  energy_regen: "Energy Regen",
  all_multiplier: "All Gains",
};

interface ActiveBoostsIndicatorProps {
  boosts: ActiveBoost[];
}

export const ActiveBoostsIndicator = ({ boosts }: ActiveBoostsIndicatorProps) => {
  const [, setTick] = useState(0);

  // Update every minute to refresh time remaining
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (expiresAt: string): string => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (boosts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="flex flex-wrap items-center gap-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Active Boosts
          </div>
          <div className="flex flex-wrap gap-2">
            {boosts.map((boost) => (
              <Badge
                key={boost.id}
                variant="secondary"
                className="gap-2 bg-primary/10 text-primary"
              >
                {boostIcons[boost.boost_type] || <Sparkles className="h-4 w-4" />}
                <span>
                  {boostLabels[boost.boost_type] || boost.boost_type}{" "}
                  {boost.boost_value !== 1 && (
                    <>+{Math.round((boost.boost_value - 1) * 100)}%</>
                  )}
                </span>
                <span className="flex items-center gap-1 text-xs opacity-70">
                  <Clock className="h-3 w-3" />
                  {formatTimeRemaining(boost.expires_at)}
                </span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
