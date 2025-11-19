import { ArrowDownRight, ArrowRight, ArrowUpRight, HeartPulse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SentimentSnapshot } from "./types";

interface SentimentWidgetProps {
  snapshot: SentimentSnapshot | null;
  isLoading?: boolean;
}

const trendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

const trendColor: Record<SentimentSnapshot["trend"], string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

export function SentimentWidget({ snapshot, isLoading }: SentimentWidgetProps) {
  const TrendIcon = snapshot ? trendIcon[snapshot.trend] : ArrowRight;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">Sentiment Pulse</CardTitle>
            <CardDescription>Track how press and fans feel right now.</CardDescription>
          </div>
        </div>
        <Badge variant="secondary">Live</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : snapshot ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold">{snapshot.score}</span>
              <TrendIcon className={`h-6 w-6 ${trendColor[snapshot.trend]}`} />
            </div>
            <p className="text-sm text-muted-foreground">{snapshot.summary}</p>
            <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
              <span>Mentions monitored</span>
              <span className="font-semibold">{snapshot.mentions.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sentiment data unavailable.</p>
        )}
      </CardContent>
    </Card>
  );
}
