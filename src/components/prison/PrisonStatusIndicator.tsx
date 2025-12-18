import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Lock, AlertTriangle } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { usePrisonStatus } from "@/hooks/usePrisonStatus";
import { Link } from "react-router-dom";
import { differenceInDays, differenceInHours } from "date-fns";

export const PrisonStatusIndicator = () => {
  const { profile } = useGameData();
  const { imprisonment, isImprisoned } = usePrisonStatus();
  
  const cash = (profile as any)?.cash || 0;
  const isInDebt = cash < 0;
  const isWanted = (profile as any)?.is_wanted;
  
  // Show nothing if not in debt, not imprisoned, and not wanted
  if (!isInDebt && !isImprisoned && !isWanted) return null;
  
  // Imprisoned state
  if (isImprisoned && imprisonment) {
    const releaseDate = new Date(imprisonment.release_date);
    const hoursRemaining = differenceInHours(releaseDate, new Date());
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Lock className="h-4 w-4 text-destructive" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <Lock className="h-4 w-4" />
              Imprisoned
            </div>
            <p className="text-sm text-muted-foreground">
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
            </p>
            <p className="text-xs text-muted-foreground">
              Behavior: {imprisonment.behavior_score}/100
            </p>
            <Link to="/prison">
              <Button size="sm" className="w-full mt-2">View Prison Status</Button>
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  
  // Wanted state
  if (isWanted) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-warning rounded-full animate-pulse" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-warning font-semibold">
              <AlertTriangle className="h-4 w-4" />
              WANTED
            </div>
            <p className="text-sm text-muted-foreground">
              You escaped prison and are wanted by authorities. Avoid public activities!
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  
  // In debt state (warning only)
  if (isInDebt) {
    const debtStartedAt = (profile as any)?.debt_started_at;
    let daysUntilPrison = 5;
    
    if (debtStartedAt) {
      const daysSinceDebt = differenceInDays(new Date(), new Date(debtStartedAt));
      daysUntilPrison = Math.max(0, 5 - daysSinceDebt);
    }
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <AlertTriangle className={`h-4 w-4 ${daysUntilPrison <= 2 ? 'text-destructive' : 'text-warning'}`} />
            {daysUntilPrison <= 2 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <div className={`flex items-center gap-2 font-semibold ${daysUntilPrison <= 2 ? 'text-destructive' : 'text-warning'}`}>
              <AlertTriangle className="h-4 w-4" />
              In Debt
            </div>
            <p className="text-sm text-muted-foreground">
              ${Math.abs(cash).toLocaleString()} owed
            </p>
            <p className="text-xs text-muted-foreground">
              {daysUntilPrison} {daysUntilPrison === 1 ? "day" : "days"} until imprisonment
            </p>
            <Link to="/gig-booking">
              <Button size="sm" variant="outline" className="w-full mt-2">Earn Money</Button>
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  
  return null;
};
