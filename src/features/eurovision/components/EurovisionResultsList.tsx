import { Crown, Flag, Music2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EurovisionEntryResult } from "@/lib/eurovision";
import { Separator } from "@/components/ui/separator";

interface EurovisionResultsListProps {
  year?: number;
  entries?: EurovisionEntryResult[];
  winner?: EurovisionEntryResult;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export const EurovisionResultsList = ({
  year,
  entries,
  winner,
  isLoading,
  error,
  onRetry,
}: EurovisionResultsListProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Loading Eurovision results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="space-y-2 rounded-lg border p-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load results</AlertTitle>
        <AlertDescription className="flex items-center gap-4">
          <span>{error}</span>
          {onRetry && (
            <button
              className="text-sm font-medium text-primary underline"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Eurovision Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {year ? `No entries recorded for ${year}.` : "Select a year to see the results."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Eurovision Results {year ? `· ${year}` : ""}
          </CardTitle>
          {winner && (
            <Badge className="flex items-center gap-1" variant="default">
              <Crown className="h-4 w-4" />
              Winner: {winner.country}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry) => (
          <div
            key={entry.entryId}
            className={`rounded-lg border p-4 shadow-sm transition hover:shadow-md ${entry.isWinner ? "border-primary bg-primary/5" : ""}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <Flag className="h-3 w-3" />
                    {entry.country}
                  </Badge>
                  {entry.isWinner && (
                    <Badge className="flex items-center gap-1" variant="default">
                      <Crown className="h-3 w-3" />
                      Winner
                    </Badge>
                  )}
                  {entry.placement && !entry.isWinner && (
                    <Badge variant="outline" className="text-xs">
                      {`#${entry.placement}`}
                    </Badge>
                  )}
                </div>
                <p className="text-lg font-semibold leading-tight">{entry.songTitle}</p>
                <p className="text-sm text-muted-foreground">{entry.artist}</p>
              </div>
              <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{entry.totalPoints} pts</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Jury: {entry.juryPoints}</Badge>
                  <Badge variant="secondary">Televote: {entry.televotePoints}</Badge>
                </div>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Entry ID: {entry.entryId}</span>
              {entry.placement && <span>Placement: #{entry.placement}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
