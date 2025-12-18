import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { differenceInDays } from "date-fns";

export const DebtWarningBanner = () => {
  const { profile } = useGameData();
  
  if (!profile) return null;
  
  const cash = (profile as any)?.cash || 0;
  const debtStartedAt = (profile as any)?.debt_started_at;
  const isImprisoned = (profile as any)?.is_imprisoned;
  
  // Don't show if not in debt or already imprisoned
  if (cash >= 0 || isImprisoned) return null;
  
  const debtAmount = Math.abs(cash);
  let daysUntilPrison = 5;
  
  if (debtStartedAt) {
    const daysSinceDebt = differenceInDays(new Date(), new Date(debtStartedAt));
    daysUntilPrison = Math.max(0, 5 - daysSinceDebt);
  }
  
  const isUrgent = daysUntilPrison <= 2;
  
  return (
    <Alert variant="destructive" className={`mb-4 ${isUrgent ? 'animate-pulse border-2' : ''}`}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {isUrgent ? "🚨 Final Warning!" : "⚠️ You are in debt!"}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          You owe <span className="font-bold text-destructive">${debtAmount.toLocaleString()}</span>.
          {daysUntilPrison > 0 ? (
            <>
              {" "}Clear your debt within{" "}
              <span className="font-bold flex items-center gap-1 inline-flex">
                <Clock className="h-3 w-3" />
                {daysUntilPrison} {daysUntilPrison === 1 ? "day" : "days"}
              </span>{" "}
              or face imprisonment.
            </>
          ) : (
            <span className="font-bold"> Imprisonment is imminent!</span>
          )}
        </p>
        <div className="flex gap-2 mt-3">
          <Link to="/gig-booking">
            <Button variant="outline" size="sm">Book a Gig</Button>
          </Link>
          <Link to="/jobs">
            <Button variant="outline" size="sm">Find Work</Button>
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  );
};
