import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Vote, 
  Crown, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  Trophy,
  CheckCircle2,
  AlertCircle,
  UserPlus
} from "lucide-react";
import { useCityElection, useElectionCandidates, useUserVote, useCastVote } from "@/hooks/useCityElections";
import { useCityMayor } from "@/hooks/useMayorDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { format } from "date-fns";
import { CandidateCard } from "@/components/city/CandidateCard";
import { CandidateRegistrationDialog } from "@/components/city/CandidateRegistrationDialog";
import { useState } from "react";
import { ELECTION_PHASE_DESCRIPTIONS } from "@/types/city-governance";

export default function CityElection() {
  const { cityId } = useParams<{ cityId: string }>();
  const { user } = useAuth();
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);

  // Fetch city info
  const { data: city } = useQuery({
    queryKey: ["city", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .eq("id", cityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!cityId,
  });

  // Fetch election data
  const { data: election, isLoading: electionLoading } = useCityElection(cityId);
  const { data: candidates, isLoading: candidatesLoading } = useElectionCandidates(election?.id);
  const { data: userVote } = useUserVote(election?.id);
  const { data: mayor } = useCityMayor(cityId);
  const castVote = useCastVote();

  // Check if user is already a candidate
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, fame")
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const isCandidate = candidates?.some(c => c.profile_id === userProfile?.id);
  const canRegister = election?.status === "nomination" && !isCandidate && (userProfile?.fame || 0) >= 100;
  const isVotingPhase = election?.status === "voting";
  const hasVoted = !!userVote;

  const handleVote = (candidateId: string) => {
    if (!election?.id || hasVoted) return;
    castVote.mutate({ electionId: election.id, candidateId });
  };

  const getPhaseEndDate = () => {
    if (!election) return null;
    if (election.status === "nomination") return new Date(election.nomination_end);
    if (election.status === "voting") return new Date(election.voting_end);
    return null;
  };

  const phaseEndDate = getPhaseEndDate();

  if (electionLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" asChild className="mb-4">
          <Link to={`/cities/${cityId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to City
          </Link>
        </Button>
        
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h2 className="text-xl font-semibold mb-2">No Active Election</h2>
            <p className="text-muted-foreground">
              There is no election currently running in {city?.name || "this city"}.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Elections occur annually during the election season.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2">
            <Link to={`/cities/${cityId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {city?.name || "City"}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" />
            Mayoral Election - Year {election.election_year}
          </h1>
          <p className="text-muted-foreground">{city?.name}, {city?.country}</p>
        </div>
        
        <Badge 
          variant={isVotingPhase ? "default" : "secondary"} 
          className="text-lg px-4 py-2"
        >
          {isVotingPhase ? "Voting Phase" : "Nomination Phase"}
        </Badge>
      </div>

      {/* Election Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Election Status
          </CardTitle>
          <CardDescription>
            {ELECTION_PHASE_DESCRIPTIONS[election.status]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold">{candidates?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Candidates</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold">{election.total_votes || 0}</div>
              <div className="text-xs text-muted-foreground">Votes Cast</div>
            </div>
            {phaseEndDate && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(phaseEndDate, "MMM d")}
                </div>
                <div className="text-xs text-muted-foreground">Phase Ends</div>
              </div>
            )}
            {election.voter_turnout_pct && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold">{election.voter_turnout_pct}%</div>
                <div className="text-xs text-muted-foreground">Turnout</div>
              </div>
            )}
          </div>

          {/* Current Mayor Info */}
          {mayor && (
            <div className="mt-4 p-3 rounded-lg border flex items-center gap-3">
              <Crown className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-sm font-medium">Current Mayor: {mayor.profile?.stage_name || "Unknown"}</div>
                <div className="text-xs text-muted-foreground">
                  Term ends: {mayor.term_end ? format(new Date(mayor.term_end), "MMM d, yyyy") : "TBD"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Status Alerts */}
      {user && (
        <div className="space-y-3">
          {hasVoted && (
            <Alert className="border-primary/50 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="flex items-center justify-between">
                <span>You have already voted in this election!</span>
                {userVote?.candidate_id && (
                  <Badge variant="outline">
                    Voted for: {candidates?.find(c => c.id === userVote.candidate_id)?.profile?.stage_name || "Unknown"}
                  </Badge>
                )}
              </AlertDescription>
            </Alert>
          )}

          {isCandidate && (
            <Alert className="border-primary/50 bg-primary/5">
              <Trophy className="h-4 w-4 text-primary" />
              <AlertDescription>
                You are running as a candidate in this election!
              </AlertDescription>
            </Alert>
          )}

          {election.status === "nomination" && !isCandidate && (userProfile?.fame || 0) < 100 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need at least 100 fame to run for mayor. Current fame: {userProfile?.fame || 0}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Run for Mayor Button */}
      {canRegister && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Run for Mayor
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You have {userProfile?.fame} fame. Register as a candidate and share your vision for {city?.name}!
                </p>
              </div>
              <Button onClick={() => setShowRegistrationDialog(true)}>
                Register as Candidate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Candidates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Candidates ({candidates?.length || 0})
          </CardTitle>
          <CardDescription>
            {isVotingPhase 
              ? "Cast your vote for your preferred candidate"
              : "Current registered candidates for this election"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidatesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
              ))}
            </div>
          ) : candidates && candidates.length > 0 ? (
            <div className="space-y-3">
              {candidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  rank={index + 1}
                  onVote={() => handleVote(candidate.id)}
                  hasVoted={hasVoted}
                  isVotingPhase={isVotingPhase}
                  userVotedFor={userVote?.candidate_id === candidate.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No candidates have registered yet.</p>
              {election.status === "nomination" && (
                <p className="text-sm mt-1">Be the first to run for mayor!</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidate Registration Dialog */}
      {election && (
        <CandidateRegistrationDialog
          open={showRegistrationDialog}
          onOpenChange={setShowRegistrationDialog}
          electionId={election.id}
          cityName={city?.name || ""}
        />
      )}
    </div>
  );
}
