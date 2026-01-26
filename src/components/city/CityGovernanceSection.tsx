import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Landmark, Crown, Vote, Calendar, Clock, Users, ChevronRight } from "lucide-react";
import { useCityMayor } from "@/hooks/useMayorDashboard";
import { useCityElection } from "@/hooks/useCityElections";
import { useCityLaws } from "@/hooks/useCityLaws";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface CityGovernanceSectionProps {
  cityId: string;
  cityName: string;
}

const ELECTION_PHASE_INFO = {
  nomination: {
    label: "Nominations Open",
    description: "Players with 100+ fame can run for mayor",
    color: "bg-secondary",
  },
  voting: {
    label: "Voting Phase",
    description: "Cast your vote for the next mayor",
    color: "bg-primary",
  },
  campaign: {
    label: "Campaign Phase", 
    description: "Candidates are campaigning",
    color: "bg-accent",
  },
};

export function CityGovernanceSection({ cityId, cityName }: CityGovernanceSectionProps) {
  const { data: mayor, isLoading: mayorLoading } = useCityMayor(cityId);
  const { data: election, isLoading: electionLoading } = useCityElection(cityId);
  const { data: laws } = useCityLaws(cityId);

  const isLoading = mayorLoading || electionLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          City Governance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Mayor Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Current Mayor
          </h4>
          
          {isLoading ? (
            <div className="animate-pulse flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
          ) : mayor ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                  <AvatarImage src={mayor.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {mayor.profile?.stage_name?.charAt(0) || "M"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {mayor.profile?.stage_name || "Unknown Mayor"}
                    <Crown className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Term: {new Date(mayor.term_start).getFullYear()} - {mayor.term_end ? new Date(mayor.term_end).getFullYear() : "Present"}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="bg-primary/5">
                {mayor.approval_rating || 50}% Approval
              </Badge>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
              <Crown className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No mayor elected yet</p>
              <p className="text-xs">Elections will be held during the election season</p>
            </div>
          )}
        </div>

        {/* Election Status Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Vote className="h-4 w-4" />
            Election Status
          </h4>

          {election ? (
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-semibold">Year {election.election_year} Election</h5>
                    <Badge className={ELECTION_PHASE_INFO[election.status as keyof typeof ELECTION_PHASE_INFO]?.color}>
                      {ELECTION_PHASE_INFO[election.status as keyof typeof ELECTION_PHASE_INFO]?.label || election.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ELECTION_PHASE_INFO[election.status as keyof typeof ELECTION_PHASE_INFO]?.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                {election.status === "nomination" && election.nomination_end && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Ends: {format(new Date(election.nomination_end), "MMM d, yyyy")}</span>
                  </div>
                )}
                {election.status === "voting" && election.voting_end && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Voting ends: {format(new Date(election.voting_end), "MMM d, yyyy")}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{election.total_votes || 0} votes cast</span>
                </div>
              </div>

              <Button size="sm" className="w-full" asChild>
                <Link to={`/cities/${cityId}/election`}>
                  {election.status === "voting" ? "Cast Your Vote" : "View Candidates"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No active election</p>
              <p className="text-xs text-muted-foreground">
                Elections occur annually: Nominations (Month 10), Voting (Month 12)
              </p>
            </div>
          )}
        </div>

        {/* Quick Laws Summary */}
        {laws && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Key Local Laws</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold">{laws.income_tax_rate}%</div>
                <div className="text-xs text-muted-foreground">Income Tax</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold">{laws.sales_tax_rate}%</div>
                <div className="text-xs text-muted-foreground">Sales Tax</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold">{laws.alcohol_legal_age}+</div>
                <div className="text-xs text-muted-foreground">Alcohol Age</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold">
                  {laws.noise_curfew_hour ? `${laws.noise_curfew_hour}:00` : "None"}
                </div>
                <div className="text-xs text-muted-foreground">Curfew</div>
              </div>
            </div>
            
            {(laws.prohibited_genres.length > 0 || laws.promoted_genres.length > 0) && (
              <div className="flex flex-wrap gap-1 pt-2">
                {laws.promoted_genres.slice(0, 2).map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs border-primary/50 text-primary">
                    ✓ {genre}
                  </Badge>
                ))}
                {laws.prohibited_genres.slice(0, 2).map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs border-destructive/50 text-destructive">
                    ✗ {genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
