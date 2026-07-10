import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Activity } from "lucide-react";
import { useBandContributions } from "@/hooks/useBandContributions";
import {
  getContributionDisplay,
  getContributionSourceLabel,
  isVerifiedContribution,
  summarizeContributions,
  type BandContributionEvent,
} from "@/lib/bandContributions";

interface BandContributionsTabProps {
  bandId: string;
}

function playerName(event: BandContributionEvent) {
  return event.profiles?.display_name || event.profiles?.username || "Unknown player";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function BandContributionsTab({ bandId }: BandContributionsTabProps) {
  const { data: events = [], isLoading, isError, error } = useBandContributions(bandId);
  const summary = summarizeContributions(events);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="h-5 w-5" /> Unable to load participation history</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : "Please try again later."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent contributions</CardTitle>
          <CardDescription>No contribution events have been recorded yet. New completed band activity will appear here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Band activity</CardTitle>
            <CardDescription>Last 50 contribution events. Based on recorded participation where source data supports it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            {summary.byType.map(({ type, count }) => {
              const display = getContributionDisplay(type);
              const Icon = display.icon;
              return (
                <div key={type} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" aria-hidden="true" />{display.shortLabel}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Member summary</CardTitle>
            <CardDescription>Based on recorded participation. Counts only, not a ranking or reward calculation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.byMember.map(({ profileId, profile, count }) => {
              const name = profile?.display_name || profile?.username || "Unknown player";
              return (
                <div key={profileId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url ?? undefined} alt="" /><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
                    <span className="truncate text-sm font-medium">{name}</span>
                  </div>
                  <Badge variant="outline">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent contributions</CardTitle>
          <CardDescription>Read-only participation history visible to current band members. Verified labels mean participant records were used.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3" aria-label="Recent band contribution events">
            {events.map((event) => {
              const display = getContributionDisplay(event.contribution_type);
              const Icon = display.icon;
              const name = playerName(event);
              return (
                <li key={event.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar><AvatarImage src={event.profiles?.avatar_url ?? undefined} alt="" /><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" aria-hidden="true" />{display.label}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{getContributionSourceLabel(event)}</span>{isVerifiedContribution(event) ? <Badge variant="outline">Verified participation</Badge> : null}</div>
                    </div>
                  </div>
                  <time className="text-sm text-muted-foreground" dateTime={event.occurred_at}>{formatTimestamp(event.occurred_at)}</time>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
