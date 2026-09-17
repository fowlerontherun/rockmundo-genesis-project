import { useMemo, useState } from "react";
import { ListVideo, PauseCircle, PlayCircle, SkipBack, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TotpBroadcastReplay } from "./api";
import { TotpArchivePlayer } from "./TotpArchivePlayer";

export interface TotpFullEpisodePlayerProps {
  replays: TotpBroadcastReplay[];
}

export function TotpFullEpisodePlayer({ replays }: TotpFullEpisodePlayerProps) {
  const ordered = useMemo(
    () => [...replays].sort((a, b) => Number(a.payload.runningOrder) - Number(b.payload.runningOrder)),
    [replays],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [continuous, setContinuous] = useState(false);
  const current = ordered[currentIndex] ?? null;

  if (!current) return null;

  const completedActs = currentIndex;
  const programmeProgress = ordered.length > 0 ? (completedActs / ordered.length) * 100 : 0;
  const goTo = (index: number) => setCurrentIndex(Math.max(0, Math.min(ordered.length - 1, index)));
  const next = () => {
    if (currentIndex < ordered.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      setContinuous(false);
    }
  };

  return (
    <section className="space-y-3" data-totp-full-episode-player>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListVideo className="h-4 w-4" /> Full episode playback
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Play the archived running order as one continuous television programme. Archive playback never awards fame, XP or money.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Act {currentIndex + 1} of {ordered.length}</Badge>
            <Button size="sm" onClick={() => setContinuous((value) => !value)}>
              {continuous ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {continuous ? "Stop autoplay" : "Play full episode"}
            </Button>
          </div>
        </div>
        <Progress value={programmeProgress} className="mt-3 h-1.5" />
        <div className="mt-3 flex flex-wrap gap-2">
          {ordered.map((replay, index) => (
            <Button
              key={replay.id}
              size="sm"
              variant={index === currentIndex ? "default" : "outline"}
              onClick={() => goTo(index)}
              className="h-auto whitespace-normal text-left"
            >
              {replay.payload.runningOrder}. {replay.payload.band.name} — {replay.payload.song.title}
            </Button>
          ))}
        </div>
      </div>

      <TotpArchivePlayer
        key={`${current.id}:${continuous ? "auto" : "manual"}`}
        replay={current}
        autoPlay={continuous}
        onEnded={continuous ? next : undefined}
      />

      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
          <SkipBack className="mr-2 h-4 w-4" /> Previous act
        </Button>
        <Button size="sm" variant="outline" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex >= ordered.length - 1}>
          Next act <SkipForward className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

export default TotpFullEpisodePlayer;
