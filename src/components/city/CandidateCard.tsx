import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CityCandidate } from "@/types/city-governance";
import { Vote, Trophy, Users } from "lucide-react";

interface CandidateCardProps {
  candidate: CityCandidate;
  rank: number;
  onVote?: () => void;
  hasVoted?: boolean;
  isVotingPhase?: boolean;
  userVotedFor?: boolean;
}

export function CandidateCard({ 
  candidate, 
  rank, 
  onVote, 
  hasVoted, 
  isVotingPhase,
  userVotedFor 
}: CandidateCardProps) {
  const stageName = candidate.profile?.stage_name || "Unknown Candidate";
  const avatarUrl = candidate.profile?.avatar_url;
  const fame = candidate.profile?.fame || 0;

  return (
    <Card className={`transition-all ${userVotedFor ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold">
            {rank === 1 ? <Trophy className="h-4 w-4 text-yellow-500" /> : `#${rank}`}
          </div>

          {/* Avatar */}
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl || undefined} alt={stageName} />
            <AvatarFallback>{stageName.charAt(0)}</AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{stageName}</h4>
              {userVotedFor && (
                <Badge variant="default" className="text-xs">Your Vote</Badge>
              )}
            </div>
            
            {candidate.campaign_slogan && (
              <p className="text-sm text-muted-foreground italic mt-1">
                "{candidate.campaign_slogan}"
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {candidate.vote_count} votes
              </span>
              <span>Fame: {fame}</span>
            </div>
          </div>

          {/* Vote Button */}
          {isVotingPhase && !hasVoted && onVote && (
            <Button onClick={onVote} size="sm">
              <Vote className="h-4 w-4 mr-1" />
              Vote
            </Button>
          )}
        </div>

        {/* Proposed Policies Preview */}
        {Object.keys(candidate.proposed_policies || {}).length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-1">Proposed Changes:</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(candidate.proposed_policies).slice(0, 3).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key.replace(/_/g, " ")}: {String(value)}
                </Badge>
              ))}
              {Object.keys(candidate.proposed_policies).length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{Object.keys(candidate.proposed_policies).length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
