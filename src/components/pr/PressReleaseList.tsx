import { Calendar, Megaphone, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PressRelease } from "./types";

interface PressReleaseListProps {
  releases: PressRelease[];
  isLoading?: boolean;
}

const sentimentColors: Record<PressRelease["sentiment"], string> = {
  positive: "bg-success/15 text-success border-success/30",
  neutral: "bg-muted text-foreground border-muted-foreground/40",
  negative: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusVariants: Record<PressRelease["status"], string> = {
  draft: "border border-dashed border-muted-foreground/40",
  scheduled: "border border-primary/30 bg-primary/5",
  published: "border border-success/30 bg-success/10",
};

export function PressReleaseList({ releases, isLoading }: PressReleaseListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          <CardTitle>Press Releases</CardTitle>
        </div>
        <Badge variant="outline">{releases.length} tracked</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="mt-3 h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : releases.length === 0 ? (
          <EmptyState
            title="No press releases yet"
            description="Publish a release to share band news across your channels."
            icon={Megaphone}
          />
        ) : (
          <div className="space-y-3">
            {releases.map((release) => (
              <div
                key={release.id}
                className={cn(
                  "rounded-lg p-4 shadow-sm transition hover:shadow-md",
                  statusVariants[release.status],
                )}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {release.channel}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{release.status}</span>
                    </div>
                    <p className="text-lg font-semibold leading-tight">{release.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(release.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs uppercase text-muted-foreground">Estimated reach</p>
                      <p className="text-xl font-bold">{release.reach.toLocaleString()}</p>
                    </div>
                    <Badge className={cn("capitalize border", sentimentColors[release.sentiment])}>
                      {release.sentiment}
                    </Badge>
                  </div>
                </div>
                {release.notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">{release.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
