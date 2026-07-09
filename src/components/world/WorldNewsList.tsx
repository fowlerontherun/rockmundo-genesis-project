import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, Globe2, Loader2, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWorldNews, type WorldNewsItem } from "@/lib/api/worldNews";

interface WorldNewsListProps {
  limit?: number;
  showViewAllLink?: boolean;
}

const categoryVariant: Record<WorldNewsItem["category"], "default" | "secondary" | "outline"> = {
  Charts: "default",
  Release: "secondary",
  Festival: "outline",
  Gig: "outline",
  Award: "secondary",
  Milestone: "outline",
};

const NewsRow = ({ item }: { item: WorldNewsItem }) => {
  const content = (
    <article className="rounded-lg border bg-card/60 p-3 transition-colors hover:bg-muted/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={categoryVariant[item.category]} className="text-[10px] uppercase tracking-wide">
              {item.category}
            </Badge>
            <time className="text-xs text-muted-foreground" dateTime={item.timestamp} title={format(new Date(item.timestamp), "PPpp")}>
              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
            </time>
          </div>
          <h3 className="font-medium leading-snug text-foreground">{item.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 text-[10px]">
          {item.source}
        </Badge>
      </div>
    </article>
  );

  return item.href ? <Link to={item.href}>{content}</Link> : content;
};

export function WorldNewsList({ limit = 8, showViewAllLink = true }: WorldNewsListProps) {
  const { data: items = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["world-news", limit],
    queryFn: () => fetchWorldNews(limit),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" /> World News
          </CardTitle>
          <CardDescription>Read-only headlines from charts, releases, festivals, gigs, awards, and band momentum.</CardDescription>
        </div>
        {showViewAllLink ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/world-pulse">World Pulse</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-live="polite">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="h-4 w-64 max-w-full rounded bg-muted" />
                  <div className="h-3 w-80 max-w-full rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">World news is unavailable</p>
                <p className="text-muted-foreground">The feed only reads existing tables. If none of those sources are reachable, it shows this error instead of fabricating headlines.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>Try again</Button>
              </div>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            <Globe2 className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium text-foreground">No world headlines yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm">Charts, releases, festivals, gigs, awards, or notable band movement will appear here once existing game data contains them.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => <NewsRow key={item.id} item={item} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
