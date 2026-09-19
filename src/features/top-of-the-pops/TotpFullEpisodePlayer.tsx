import { useMemo, useState } from "react";
import { ListVideo, PauseCircle, PlayCircle, SkipBack, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TotpBroadcastReplay } from "./api";
import type { TotpChartRundown } from "./chartRundownApi";
import { totpRundownHasRealPositions } from "./chartRundown";
import { TotpArchivePlayer } from "./TotpArchivePlayer";
import { TotpChartRundownSequence } from "./TotpChartRundownSequence";
import { TotpProgrammeContinuity } from "./TotpProgrammeContinuity";
import { TotpShowIntro } from "./TotpShowIntro";
import { TotpEndCredits } from "./TotpEndCredits";
import { TotpStageTransition } from "./TotpStageTransition";
import { TotpCountdownClock } from "./TotpCountdownClock";
import { TotpSegmentFade } from "./TotpSegmentFade";
import { orderTotpProgrammeReplays, type TotpContinuityKind } from "./programmeContinuity";

export interface TotpFullEpisodePlayerProps {
  replays: TotpBroadcastReplay[];
  chartRundown?: TotpChartRundown | null;
}

export function orderTotpEpisodeReplays(replays: TotpBroadcastReplay[]): TotpBroadcastReplay[] {
  return orderTotpProgrammeReplays(replays);
}

export function TotpFullEpisodePlayer({ replays, chartRundown = null }: TotpFullEpisodePlayerProps) {
  const ordered = useMemo(() => orderTotpEpisodeReplays(replays), [replays]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [continuous, setContinuous] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showChartRundown, setShowChartRundown] = useState(false);
  const [showStageTransition, setShowStageTransition] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [continuityKind, setContinuityKind] = useState<TotpContinuityKind | null>(null);
  const current = ordered[currentIndex] ?? null;
  const hasChartRundown = totpRundownHasRealPositions(chartRundown);

  if (!current) return null;

  const completedActs = currentIndex;
  const programmeProgress = ordered.length > 0 ? (completedActs / ordered.length) * 100 : 0;
  const fullEpisodeRunning = showIntro || showChartRundown || showStageTransition || showCredits || continuityKind !== null || continuous;

  const goTo = (index: number) => {
    setShowIntro(false);
    setShowChartRundown(false);
    setShowStageTransition(false);
    setShowCredits(false);
    setContinuityKind(null);
    setContinuous(false);
    setCurrentIndex(Math.max(0, Math.min(ordered.length - 1, index)));
  };

  const startFullEpisode = () => {
    setCurrentIndex(0);
    setShowChartRundown(false);
    setShowStageTransition(false);
    setShowCredits(false);
    setContinuityKind(null);
    setContinuous(false);
    setShowIntro(true);
  };

  const stopFullEpisode = () => {
    setShowIntro(false);
    setShowChartRundown(false);
    setShowStageTransition(false);
    setShowCredits(false);
    setContinuityKind(null);
    setContinuous(false);
  };


  const finishIntro = () => {
    setShowIntro(false);
    setContinuous(true);
    setContinuityKind("opening");
  };

  const finishAct = () => {
    if (currentIndex < ordered.length - 1) {
      setShowStageTransition(true);
      return;
    }
    setContinuityKind("closing");
  };

  const finishStageTransition = () => {
    setShowStageTransition(false);
    setContinuityKind("between");
  };

  const finishContinuity = () => {
    if (continuityKind === "opening") {
      setContinuityKind(null);
      if (ordered.length === 1 && hasChartRundown) setShowChartRundown(true);
      return;
    }
    if (continuityKind === "between") {
      setContinuityKind(null);
      if (currentIndex === ordered.length - 2 && hasChartRundown) {
        setShowChartRundown(true);
        return;
      }
      setCurrentIndex((index) => Math.min(ordered.length - 1, index + 1));
      return;
    }
    setContinuityKind(null);
    setShowCredits(true);
  };

  const finishCredits = () => {
    setShowCredits(false);
    setContinuous(false);
  };

  const finishChartRundown = () => {
    setShowChartRundown(false);
    if (currentIndex < ordered.length - 1) {
      setCurrentIndex((index) => Math.min(ordered.length - 1, index + 1));
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
              Play the programme intro, presenter continuity, frozen UK Streaming and Digital Sales rundown, and archived running order as one continuous television show. Archive playback never awards fame, XP or money.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {showCredits
                ? "End credits"
                : showIntro
                ? "Programme intro"
                : showChartRundown
                  ? "Chart rundown"
                  : showStageTransition
                    ? "Studio reset"
                    : continuityKind
                    ? continuityKind === "opening"
                      ? "Studio opening"
                      : continuityKind === "between"
                        ? "Presenter link"
                        : "Programme close"
                    : `Act ${currentIndex + 1} of ${ordered.length}`}
            </Badge>
            <Button size="sm" onClick={fullEpisodeRunning ? stopFullEpisode : startFullEpisode}>
              {fullEpisodeRunning ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {fullEpisodeRunning ? "Stop full episode" : "Play full episode"}
            </Button>
          </div>
        </div>
        <Progress value={showIntro ? 0 : programmeProgress} className="mt-3 h-1.5" />
        <div className="mt-3 flex flex-wrap gap-2">
          {ordered.map((replay, index) => (
            <Button
              key={replay.id}
              size="sm"
              variant={!showIntro && !showChartRundown && continuityKind === null && index === currentIndex ? "default" : "outline"}
              onClick={() => goTo(index)}
              className="h-auto whitespace-normal text-left"
            >
              {replay.payload.runningOrder}. {replay.payload.band.name} — {replay.payload.song.title}
            </Button>
          ))}
        </div>
      </div>

      {showIntro ? (
        <TotpShowIntro playing onEnded={finishIntro} />
      ) : showStageTransition && ordered[currentIndex + 1] ? (
        <TotpStageTransition
          from={current}
          to={ordered[currentIndex + 1]}
          autoPlay={continuous}
          onEnded={finishStageTransition}
        />
      ) : continuityKind ? (
        <TotpProgrammeContinuity
          kind={continuityKind}
          replays={ordered}
          currentIndex={currentIndex}
          autoPlay={continuous}
          onEnded={finishContinuity}
        />
      ) : showChartRundown && chartRundown ? (
        <TotpChartRundownSequence rundown={chartRundown} autoPlay={continuous} onEnded={finishChartRundown} />
      ) : showCredits ? (
        <TotpEndCredits replays={ordered} autoPlay onEnded={finishCredits} />
      ) : (
        <TotpArchivePlayer
          key={`${current.id}:${continuous ? "auto" : "manual"}`}
          replay={current}
          autoPlay={continuous}
          onEnded={continuous ? finishAct : undefined}
        />
      )}

      {!showIntro && !showChartRundown && !showStageTransition && !showCredits && continuityKind === null && !continuous ? (
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
            <SkipBack className="mr-2 h-4 w-4" /> Previous act
          </Button>
          <Button size="sm" variant="outline" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex >= ordered.length - 1}>
            Next act <SkipForward className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export default TotpFullEpisodePlayer;
