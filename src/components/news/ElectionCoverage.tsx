import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";
import { useRecentElectionArticles } from "@/hooks/useElectionCampaign";
import { formatDistanceToNow } from "date-fns";

export function ElectionCoverage() {
  const { data: articles } = useRecentElectionArticles(5);
  if (!articles || articles.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          Election Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {articles.map((a) => (
          <article key={a.id} className="border-b border-border/50 pb-2 last:border-0">
            <h4 className="font-semibold text-sm font-serif">{a.headline}</h4>
            <p className="text-xs text-muted-foreground mb-1">
              {formatDistanceToNow(new Date(a.published_at), { addSuffix: true })}
            </p>
            <p className="text-xs whitespace-pre-wrap line-clamp-3">{a.body}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
