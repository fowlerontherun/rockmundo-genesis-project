import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CityCandidate } from "@/types/city-governance";
import { Vote, Trophy, Users, Award } from "lucide-react";
import type { PartyEndorsement } from "@/hooks/usePartyEndorsements";
import { CandidateManifestoDialog } from "@/components/elections/CandidateManifestoDialog";

interface CandidateCardProps {
  candidate: CityCandidate;
  rank: number;
  onVote?: () => void;
  hasVoted?: boolean;
  isVotingPhase?: boolean;
  userVotedFor?: boolean;
  endorsements?: PartyEndorsement[];
}

export function CandidateCard({
  candidate,
  rank,
  onVote,
  hasVoted,
  isVotingPhase,
  userVotedFor,
  endorsements = [],
}: CandidateCardProps) {
  const stageName = candidate.profile?.stage_name || "Unknown Candidate";
  const avatarUrl = candidate.profile?.avatar_url;
  const fame = candidate.profile?.fame || 0;

  const myEndorsements = endorsements.filter((e) => e.candidate_id === candidate.id);
  const [manifestoOpen, setManifestoOpen] = useState(false);

  const partyNameMap: Record<string, { name: string; colour_hex: string }> = {};
  for (const e of myEndorsements) {
    if (e.party) partyNameMap[e.party_id] = { name: e.party.name, colour_hex: e.party.colour_hex };
  }
  const partyIds = myEndorsements.map((e) => e.party_id);

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
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate">{stageName}</h4>
              {userVotedFor && (
                <Badge variant="default" className="text-xs">Your Vote</Badge>
              )}
              {myEndorsements.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-[11px] cursor-help">
                        <Award className="h-3 w-3 text-primary" />
                        {myEndorsements.length}
                        <span className="flex items-center gap-0.5 ml-0.5">
                          {myEndorsements.slice(0, 4).map((e) => (
                            <span
                              key={e.id}
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: e.party?.colour_hex ?? "hsl(var(--muted-foreground))" }}
                            />
                          ))}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs font-semibold mb-1">Endorsed by:</p>
                      <ul className="text-xs space-y-0.5">
                        {myEndorsements.map((e) => (
                          <li key={e.id} className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: e.party?.colour_hex ?? "hsl(var(--muted-foreground))" }}
                            />
                            {e.party?.name ?? "Unknown party"}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {candidate.campaign_slogan && (
              <p className="text-sm text-muted-foreground italic mt-1">
                "{candidate.campaign_slogan}"
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-help">
                      <Users className="h-3 w-3" />
                      <span className="font-semibold text-foreground">
                        {candidate.vote_count + (candidate.endorsement_bonus_votes ?? 0)}
                      </span>{" "}
                      votes
                      {(candidate.endorsement_bonus_votes ?? 0) > 0 && (
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                          +{candidate.endorsement_bonus_votes} boost
                        </Badge>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      <span className="font-semibold">{candidate.vote_count}</span> player votes
                    </p>
                    {(candidate.endorsement_bonus_votes ?? 0) > 0 && (
                      <p className="text-xs">
                        <span className="font-semibold text-primary">
                          +{candidate.endorsement_bonus_votes}
                        </span>{" "}
                        from party endorsements
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
