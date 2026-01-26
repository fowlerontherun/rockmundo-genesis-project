import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CityElection } from "@/types/city-governance";
import { ELECTION_PHASE_DESCRIPTIONS } from "@/types/city-governance";
import { Vote, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface ElectionBannerProps {
  election: CityElection;
  onViewElection?: () => void;
  compact?: boolean;
}

export function ElectionBanner({ election, onViewElection, compact }: ElectionBannerProps) {
  const isNomination = election.status === "nomination";
  const isVoting = election.status === "voting";

  const getEndDate = () => {
    if (isNomination) return new Date(election.nomination_end);
    if (isVoting) return new Date(election.voting_end);
    return null;
  };

  const endDate = getEndDate();

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
        <Vote className="h-4 w-4 text-primary" />
        <span className="text-sm">
          {isVoting ? "Voting Open" : "Nominations Open"} - Year {election.election_year}
        </span>
        <Button size="sm" variant="ghost" onClick={onViewElection}>
          View
        </Button>
      </div>
    );
  }

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Vote className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Mayoral Election - Year {election.election_year}
        <Badge variant={isVoting ? "default" : "secondary"}>
          {isVoting ? "Voting Phase" : "Nomination Phase"}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-2">
          {ELECTION_PHASE_DESCRIPTIONS[election.status]}
        </p>
        
        <div className="flex items-center gap-4 text-sm">
          {endDate && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Ends: {format(endDate, "MMM d, yyyy")}
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Total Votes: {election.total_votes}
          </span>
        </div>

        {onViewElection && (
          <Button className="mt-3" size="sm" onClick={onViewElection}>
            {isVoting ? "Cast Your Vote" : "View Candidates"}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
