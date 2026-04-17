import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Vote, Megaphone, ExternalLink, TrendingUp, Award } from "lucide-react";
import { format } from "date-fns";
import { usePartyCampaigns } from "@/hooks/usePartyCampaigns";

interface Props {
  partyId: string;
}

const STATUS_LABEL: Record<string, string> = {
  voting: "Voting",
  nomination: "Nominations",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  voting: "default",
  nomination: "secondary",
  completed: "outline",
  cancelled: "outline",
};

export function PartyCampaignsTab({ partyId }: Props) {
  const { data: rows, isLoading } = usePartyCampaigns(partyId);

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }

  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium">No active endorsements</p>
          <p className="text-xs text-muted-foreground mt-1">
            Endorse a candidate from any city election to track their performance here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = rows.filter((r) => r.election_status === "voting" || r.election_status === "nomination");
  const leading = active.filter((r) => r.is_leading).length;
  const totalBonus = rows.reduce((sum, r) => sum + r.endorsement_bonus, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Active campaigns</p>
            <p className="text-2xl font-bold">{active.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Currently leading</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Trophy className="h-5 w-5 text-warning" />
              {leading}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Votes contributed</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Award className="h-5 w-5 text-primary" />
              +{totalBonus}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign list */}
      <div className="space-y-2">
        {rows.map((row) => {
          const isActive = row.election_status === "voting" || row.election_status === "nomination";

          return (
            <Card key={row.endorsement_id} className={row.is_leading && isActive ? "ring-1 ring-primary/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={row.candidate_avatar ?? undefined} alt={row.candidate_name} />
                    <AvatarFallback>{row.candidate_name.charAt(0)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold truncate">{row.candidate_name}</h4>
                      <Badge variant={STATUS_VARIANT[row.election_status] ?? "outline"} className="text-[10px]">
                        {STATUS_LABEL[row.election_status] ?? row.election_status}
                      </Badge>
                      {row.is_leading && isActive && (
                        <Badge className="text-[10px] gap-1">
                          <Trophy className="h-3 w-3" /> Leading
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{row.city_name}</span>
                      {row.country ? `, ${row.country}` : ""} · Year {row.election_year} · Rank #{row.rank}/
                      {row.total_candidates}
                    </p>

                    {row.candidate_slogan && (
                      <p className="text-xs italic text-muted-foreground truncate">"{row.candidate_slogan}"</p>
                    )}

                    <div className="flex items-center gap-4 text-xs flex-wrap pt-1">
                      <span className="flex items-center gap-1">
                        <Vote className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{row.total_votes}</span> total
                      </span>
                      <span className="text-muted-foreground">{row.player_votes} player</span>
                      {row.endorsement_bonus > 0 && (
                        <span className="flex items-center gap-1 text-primary">
                          <TrendingUp className="h-3 w-3" />+{row.endorsement_bonus} endorsement
                        </span>
                      )}
                      {isActive && row.voting_end && (
                        <span className="text-muted-foreground ml-auto">
                          Ends {format(new Date(row.voting_end), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/cities/${row.city_id}/election`}>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>

                {row.statement && (
                  <p className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <span className="font-semibold">Our statement:</span> {row.statement}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
