import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock3, Radio, Tv2 } from "lucide-react";
import type { TotpEpisode } from "./api";

export type TotpBroadcastPhase = "inviting" | "studio" | "countdown" | "live" | "completed";

export function getTotpBroadcastPhase(episode: TotpEpisode, now: Date): TotpBroadcastPhase {
  if (episode.status === "completed") return "completed";
  if (episode.status === "broadcast") return "live";

  const checkInAt = new Date(episode.check_in_at).getTime();
  const broadcastAt = new Date(episode.broadcast_at).getTime();
  const nowMs = now.getTime();

  if (nowMs >= broadcastAt) return "live";
  if (nowMs >= checkInAt) return "countdown";
  if (nowMs >= checkInAt - 2 * 60 * 60 * 1000) return "studio";
  return "inviting";
}

function formatRemaining(target: Date, now: Date) {
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatLondonTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function TotpBroadcastStatusCard({ episode, archiveReady }: { episode: TotpEpisode; archiveReady: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = useMemo(() => getTotpBroadcastPhase(episode, now), [episode, now]);
  const broadcastAt = new Date(episode.broadcast_at);
  const checkInAt = new Date(episode.check_in_at);

  const content = (() => {
    switch (phase) {
      case "completed":
        return {
          label: "Broadcast complete",
          title: archiveReady ? "Episode available to watch" : "Episode complete",
          detail: archiveReady
            ? "The full television replay is now available below exactly as it aired."
            : "The programme has finished. The broadcast archive is being finalised.",
          icon: Tv2,
        };
      case "live":
        return {
          label: "LIVE NOW",
          title: archiveReady ? "Top of the Pops is on air" : "Broadcast is starting",
          detail: archiveReady
            ? "The frozen broadcast feed is available below. This page updates automatically as the show progresses."
            : "The studio feed is being prepared. Keep this page open — it will update automatically.",
          icon: Radio,
        };
      case "countdown":
        return {
          label: "Studio locked",
          title: `On air in ${formatRemaining(broadcastAt, now)}`,
          detail: `The running order is being locked for the ${formatLondonTime(episode.broadcast_at)} broadcast.`,
          icon: Clock3,
        };
      case "studio":
        return {
          label: "Studio check-in",
          title: `Studio call in ${formatRemaining(checkInAt, now)}`,
          detail: "Invited acts should be in London now. Band leaders can complete studio check-in from their invitation below.",
          icon: Radio,
        };
      default:
        return {
          label: "Next broadcast",
          title: `Top of the Pops in ${formatRemaining(broadcastAt, now)}`,
          detail: `Episode #${episode.episode_number} airs ${formatLondonTime(episode.broadcast_at)} from London.`,
          icon: Tv2,
        };
    }
  })();

  const Icon = content.icon;

  return (
    <Card className={phase === "live" ? "border-primary/60 shadow-sm" : undefined} data-totp-broadcast-status={phase}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-full border bg-background p-2">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant={phase === "live" ? "default" : "secondary"}>{content.label}</Badge>
              {phase === "live" && <span className="text-xs font-medium text-muted-foreground">Auto-refreshing</span>}
            </div>
            <div className="text-lg font-semibold">{content.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{content.detail}</p>
          </div>
        </div>
        <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
          <div className="font-medium text-foreground">London studio</div>
          <div>{formatLondonTime(episode.broadcast_at)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TotpBroadcastStatusCard;
