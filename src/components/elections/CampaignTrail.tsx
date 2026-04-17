import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Megaphone, DollarSign, Newspaper } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useCampaignExpenditures,
  useElectionArticles,
} from "@/hooks/useElectionCampaign";
import { CAMPAIGN_CATEGORY_LABELS } from "@/types/political-party";

interface Props {
  electionId: string;
  candidateId?: string;
}

/**
 * Shows the campaign trail for an election: published articles
 * (one per candidate) + spend log when a specific candidate is selected.
 */
export function CampaignTrail({ electionId, candidateId }: Props) {
  const { data: articles } = useElectionArticles(electionId);
  const { data: spends } = useCampaignExpenditures(candidateId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" /> Candidate Articles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!articles || articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaign articles published yet.
            </p>
          ) : (
            <ScrollArea className="h-64">
              <ul className="space-y-3">
                {articles.map((a) => (
                  <li
                    key={a.id}
                    className="border-l-2 border-primary/40 pl-3 py-1"
                  >
                    <p className="text-sm font-semibold">{a.headline}</p>
                    <p className="text-xs text-muted-foreground mb-1">
                      {formatDistanceToNow(new Date(a.published_at), {
                        addSuffix: true,
                      })}
                    </p>
                    <p className="text-xs whitespace-pre-wrap line-clamp-4">
                      {a.body}
                    </p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {candidateId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" /> Campaign Spend Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!spends || spends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaign spending logged.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {spends.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between border-b border-border pb-1"
                  >
                    <span className="flex items-center gap-2">
                      <Megaphone className="h-3 w-3 text-muted-foreground" />
                      {CAMPAIGN_CATEGORY_LABELS[s.category]}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        +{s.effect_value} reach
                      </Badge>
                      <span className="font-medium">
                        ${(s.amount / 100).toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
