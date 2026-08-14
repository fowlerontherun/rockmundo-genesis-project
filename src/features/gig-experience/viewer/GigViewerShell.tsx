import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGigViewerReplay } from "../hooks";
import type { GigExperienceDTO } from "../types";
import type { GigViewerReplay } from "../events/types";
import { getGigExperienceErrorDisplay } from "../diagnostics";
import { GigCanvas } from "./GigCanvas";
import { GigCrowdMoodGraph } from "./GigCrowdMoodGraph";
import { GigCurrentSongPanel } from "./GigCurrentSongPanel";
import { GigResultRevealOverlay } from "./GigResultRevealOverlay";
import { GigViewerControls } from "./GigViewerControls";
import { GigViewerErrorBoundary } from "./GigViewerErrorBoundary";
import { GigViewerFallback } from "./GigViewerFallback";
import { GigViewerStatus } from "./GigViewerStatus";
import { GigViewerTimeline } from "./GigViewerTimeline";
import { GigPerformerPanel } from "./GigPerformerPanel";
import { PlayerGigStageSurface } from "./PlayerGigStageSurface";
import { fitReplayToPlayerSongExcerpts, PLAYER_SONG_EXCERPT_DURATION_MS } from "./playerReplayTimeline";
import { buildStoryModel, deriveStorySnapshot } from "./engine/StoryEngine";
import { useGigReplayPlayback } from "./hooks/useGigReplayPlayback";
import { useGigViewerPreferences } from "./hooks/useGigViewerPreferences";
import { useGigViewerAudio } from "./audio/useGigViewerAudio";
import { useCrowdAmbience } from "./audio/useCrowdAmbience";
import { selectStageType } from "./engine/VenueLayout";
import { StageTypeLabels } from "./engine/StageDecor";
import { GigViewerAudioControls } from "./audio/GigViewerAudioControls";

export type GigViewerMode = "player" | "analysis";

interface GigViewerShellProps {
  gigId: string;
  experience?: GigExperienceDTO | null;
  open: boolean;
  onViewResult: () => void;
  onClose: () => void;
  replayOverride?: GigViewerReplay | null;
  /** Player mode is an immersive show. Analysis mode is reserved for admin/testing tools. */
  mode?: GigViewerMode;
}

export function GigViewerShell(props: GigViewerShellProps) {
  if (!props.open) return null;

  const resultAction = props.experience?.viewer.ready ? props.onViewResult : undefined;
  const mode = props.mode ?? "player";

  return (
    <GigViewerErrorBoundary
      resetKey={`${props.gigId}:${props.replayOverride?.id ?? "stored"}:${mode}`}
      onResult={resultAction}
      onClose={props.onClose}
    >
      <GigViewerShellContent {...props} mode={mode} />
    </GigViewerErrorBoundary>
  );
}

function GigViewerShellContent({
  gigId,
  experience,
  open,
  onViewResult,
  onClose,
  replayOverride,
  mode = "player",
}: GigViewerShellProps) {
  const query = useGigViewerReplay(gigId, open && !replayOverride);
  const prefs = useGigViewerPreferences();
  const resultAction = experience?.viewer.ready ? onViewResult : undefined;
  const cancelled = experience && ["cancelled", "canceled", "abandoned"].includes(experience.gig.status);

  if (cancelled) {
    return (
      <GigViewerFallback
        title="Gig cancelled"
        body="This gig did not complete, so no canonical replay can be shown."
        onClose={onClose}
      />
    );
  }

  if (!replayOverride && query.isLoading) {
    return (
      <GigViewerFallback
        title="Loading replay"
        body="Opening the stored read-only replay payload."
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  if (!replayOverride && query.isError) {
    const queryError = query.error && typeof query.error === "object"
      ? query.error as { message?: unknown }
      : null;
    const message = typeof queryError?.message === "string" ? queryError.message : "Network error";
    const accessDenied = /permission|rls|denied|jwt|auth/i.test(message);
    const diagnostic = getGigExperienceErrorDisplay(query.error, gigId);

    return (
      <GigViewerFallback
        title={accessDenied ? "Access denied" : "Replay unavailable"}
        body={accessDenied
          ? "Your account cannot read this replay. Report access is unchanged if available."
          : diagnostic.body}
        diagnosticReference={diagnostic.reference}
        onRetry={() => query.refetch()}
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  const result = replayOverride ? { state: "ready" as const, replay: replayOverride } : query.data;

  if (!result || result.state === "unavailable") {
    return (
      <GigViewerFallback
        title="Replay unavailable"
        body="No stored canonical replay exists for this legacy or incomplete gig. The result report remains available when processing finishes."
        onRetry={() => query.refetch()}
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  if (result.state === "generating") {
    return (
      <GigViewerFallback
        title="Replay processing"
        body="The replay row exists but is still generating. Try again shortly; the report remains available when processing finishes."
        onRetry={() => query.refetch()}
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  if (result.state === "unsupported_version") {
    return (
      <GigViewerFallback
        title="Unsupported replay version"
        body="This stored replay uses a viewer or event-schema version this client does not support. Use the report or text timeline fallback."
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  if (result.state === "failed") {
    return (
      <GigViewerFallback
        title={result.reason === "malformed_replay" ? "Malformed replay" : "Replay generation failed"}
        body="The stored replay cannot be rendered safely. The authoritative result report remains available."
        onRetry={() => query.refetch()}
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  if (!result.replay) {
    return (
      <GigViewerFallback
        title="Malformed replay"
        body="Replay metadata loaded without a valid payload."
        onResult={resultAction}
        onClose={onClose}
      />
    );
  }

  return (
    <ReadyReplay
      replay={result.replay}
      experience={experience ?? null}
      open={open}
      prefs={prefs}
      mode={mode}
      onViewResult={onViewResult}
      onClose={onClose}
    />
  );
}

interface ReadyReplayProps {
  replay: GigViewerReplay;
  experience: GigExperienceDTO | null;
  open: boolean;
  prefs: ReturnType<typeof useGigViewerPreferences>;
  mode: GigViewerMode;
  onViewResult: () => void;
  onClose: () => void;
}

function ReadyReplay({ replay, experience, open, prefs, mode, onViewResult, onClose }: ReadyReplayProps) {
  const { reducedMotion, setReducedMotion, pyrotechnics, setPyrotechnics, cameraMode, setCameraMode } = prefs;
  const playbackReplay = useMemo(
    () => mode === "player" ? fitReplayToPlayerSongExcerpts(replay, experience) : replay,
    [mode, replay, experience],
  );
  const playback = useGigReplayPlayback(playbackReplay);
  const state = playback.state;
  const story = useMemo(() => buildStoryModel(playbackReplay, experience), [playbackReplay, experience]);
  const resultAction = playbackReplay.resultAvailable !== false && story.resultOffsetMs !== null ? onViewResult : undefined;
  const snapshot = useMemo(
    () => state ? deriveStorySnapshot(story, state.positionMs, reducedMotion) : null,
    [story, state, reducedMotion],
  );
  const audio = useGigViewerAudio({
    experience,
    snapshot,
    replaySeed: playbackReplay.simulationSeed,
    isPlaying: !!state?.isPlaying,
    speed: playback.speed,
    open,
    excerptDurationSeconds: mode === "player" ? PLAYER_SONG_EXCERPT_DURATION_MS / 1000 : undefined,
  });
  const stageType = useMemo(
    () => selectStageType({
      venueName: experience?.gig?.venue?.name ?? null,
      venueType: experience?.gig?.venue?.type ?? null,
      capacity: experience?.gig?.venue?.capacity ?? null,
    }),
    [experience?.gig?.venue?.name, experience?.gig?.venue?.type, experience?.gig?.venue?.capacity],
  );

  useCrowdAmbience({
    enabled: !!audio.enabled,
    muted: !!audio.muted,
    volume: typeof audio.volume === "number" ? audio.volume : 0.6,
    isPlaying: !!state?.isPlaying,
    snapshot,
    stageType,
  });

  const [fullscreen, setFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const popoutRef = useRef<HTMLDivElement>(null);
  const ownedNativeFullscreenElementRef = useRef<HTMLElement | null>(null);
  const nativeRequestPendingRef = useRef(false);
  const initializedPlayerReplayRef = useRef<string | null>(null);
  const seekMs = playback.seekMs;

  const exitViewerFullscreen = useCallback(() => {
    setFullscreen(false);
    const owned = ownedNativeFullscreenElementRef.current;
    if (owned && document.fullscreenElement === owned) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) exitViewerFullscreen();
    else setFullscreen(true);
  }, [exitViewerFullscreen, fullscreen]);

  useEffect(() => {
    if (!fullscreen || document.fullscreenElement || nativeRequestPendingRef.current) return;
    const host = popoutRef.current;
    if (!host?.requestFullscreen) return;
    nativeRequestPendingRef.current = true;
    try {
      void host.requestFullscreen()
        .then(() => {
          if (document.fullscreenElement === host) {
            ownedNativeFullscreenElementRef.current = host;
            setNativeFullscreen(true);
          }
        })
        .catch(() => undefined)
        .finally(() => { nativeRequestPendingRef.current = false; });
    }
    catch { /* Fixed overlay remains active. */ }
  }, [fullscreen]);

  useEffect(() => {
    exitViewerFullscreen();
  }, [playbackReplay.id, exitViewerFullscreen]);

  useEffect(() => {
    if (mode !== "player" || initializedPlayerReplayRef.current === playbackReplay.id) return;
    initializedPlayerReplayRef.current = playbackReplay.id;
    const firstSong = story.songs[0];
    if (firstSong) seekMs(firstSong.startMs);
  }, [mode, playbackReplay.id, seekMs, story.songs]);

  useEffect(() => {
    const onChange = () => {
      const current = document.fullscreenElement;
      const requested = popoutRef.current;
      if (current && current === requested) ownedNativeFullscreenElementRef.current = current as HTMLElement;
      const owned = ownedNativeFullscreenElementRef.current;
      const active = !!owned && current === owned;
      setNativeFullscreen(active);
      if (owned && !active) {
        ownedNativeFullscreenElementRef.current = null;
        setFullscreen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        exitViewerFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
      const owned = ownedNativeFullscreenElementRef.current;
      if (owned && document.fullscreenElement === owned) void document.exitFullscreen?.().catch(() => undefined);
      ownedNativeFullscreenElementRef.current = null;
    };
  }, [exitViewerFullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  if (!state || !snapshot) return null;

  const empty = playback.events.length === 0;
  const nextSong = story.songs.find((song) => song.startMs > state.positionMs);
  const previousSong = [...story.songs].reverse().find((song) => song.startMs < state.positionMs - 1000);
  const nextHighlight = story.highlights.find((highlight) => highlight.offsetMs > state.positionMs);
  const firstSong = story.songs[0];
  const playPlayerShow = () => {
    void audio.enable();
    if (state.isComplete && firstSong) playback.seekMs(firstSong.startMs);
    playback.play();
  };
  const restartPlayerShow = () => {
    void audio.enable();
    if (firstSong) playback.seekMs(firstSong.startMs);
    else playback.restart();
    playback.play();
  };

  if (empty && mode === "player") {
    return (
      <GigViewerFallback
        title="Empty performance"
        body="The saved show contains no performance events."
        onClose={onClose}
      />
    );
  }

  const analysisControls = (
    <GigViewerControls
      playing={state.isPlaying}
      complete={state.isComplete}
      speed={playback.speed}
      reducedMotion={reducedMotion}
      pyrotechnics={pyrotechnics}
      cameraMode={cameraMode}
      fullscreen={fullscreen}
      canPreviousSong={!!previousSong}
      canNextSong={!!nextSong}
      canNextHighlight={!!nextHighlight}
      canResult={story.resultOffsetMs !== null && state.positionMs < story.resultOffsetMs}
      onPlay={playback.play}
      onPause={playback.pause}
      onRestart={playback.restart}
      onSpeed={playback.setSpeed}
      onPrevious={playback.previousEvent}
      onNext={playback.nextEvent}
      onPreviousSong={() => previousSong && playback.seekMs(previousSong.startMs)}
      onNextSong={() => nextSong && playback.seekMs(nextSong.startMs)}
      onNextHighlight={() => nextHighlight && playback.seekMs(nextHighlight.offsetMs)}
      onSkipResult={() => story.resultOffsetMs !== null && playback.seekMs(story.resultOffsetMs)}
      onResult={resultAction}
      onClose={onClose}
      onReducedMotion={setReducedMotion}
      onPyrotechnics={setPyrotechnics}
      onCameraMode={setCameraMode}
      onFullscreen={toggleFullscreen}
    />
  );
  const compactControls = (
    <GigViewerControls
      compact
      playing={state.isPlaying}
      complete={state.isComplete}
      speed={playback.speed}
      reducedMotion={reducedMotion}
      pyrotechnics={pyrotechnics}
      cameraMode={cameraMode}
      fullscreen={fullscreen}
      canPreviousSong={!!previousSong}
      canNextSong={!!nextSong}
      canNextHighlight={!!nextHighlight}
      canResult={story.resultOffsetMs !== null && state.positionMs < story.resultOffsetMs}
      onPlay={playback.play}
      onPause={playback.pause}
      onRestart={playback.restart}
      onSpeed={playback.setSpeed}
      onPrevious={playback.previousEvent}
      onNext={playback.nextEvent}
      onPreviousSong={() => previousSong && playback.seekMs(previousSong.startMs)}
      onNextSong={() => nextSong && playback.seekMs(nextSong.startMs)}
      onNextHighlight={() => nextHighlight && playback.seekMs(nextHighlight.offsetMs)}
      onSkipResult={() => story.resultOffsetMs !== null && playback.seekMs(story.resultOffsetMs)}
      onResult={resultAction}
      onClose={onClose}
      onReducedMotion={setReducedMotion}
      onPyrotechnics={setPyrotechnics}
      onCameraMode={setCameraMode}
      onFullscreen={toggleFullscreen}
    />
  );

  const playerControls = (
    <GigViewerControls
      playing={state.isPlaying}
      complete={state.isComplete}
      speed={playback.speed}
      reducedMotion={reducedMotion}
      pyrotechnics={pyrotechnics}
      cameraMode={cameraMode}
      fullscreen={fullscreen}
      canPreviousSong={!!previousSong}
      canNextSong={!!nextSong}
      canNextHighlight={!!nextHighlight}
      canResult={story.resultOffsetMs !== null && state.positionMs < story.resultOffsetMs}
      onPlay={playPlayerShow}
      onPause={playback.pause}
      onRestart={restartPlayerShow}
      onSpeed={playback.setSpeed}
      onPrevious={playback.previousEvent}
      onNext={playback.nextEvent}
      onPreviousSong={() => previousSong && playback.seekMs(previousSong.startMs)}
      onNextSong={() => nextSong && playback.seekMs(nextSong.startMs)}
      onNextHighlight={() => nextHighlight && playback.seekMs(nextHighlight.offsetMs)}
      onSkipResult={() => story.resultOffsetMs !== null && playback.seekMs(story.resultOffsetMs)}
      onResult={resultAction}
      onClose={onClose}
      onReducedMotion={setReducedMotion}
      onPyrotechnics={setPyrotechnics}
      onCameraMode={setCameraMode}
      onFullscreen={toggleFullscreen}
    />
  );

  if (mode === "player") {
    const playerCanvas = (
      <GigCanvas
        replay={playbackReplay}
        experience={experience}
        playbackState={state}
        reducedMotion={reducedMotion}
        pyrotechnics={pyrotechnics}
        cameraMode={cameraMode}
        fill
        immersive
        className="h-full w-full"
      />
    );

    return (
      <GigViewerErrorBoundary onClose={onClose} resetKey={`${playbackReplay.id}:player-stage`}>
        <div
          ref={popoutRef}
          className={fullscreen ? "fixed inset-0 z-[70] h-[100dvh] w-full overflow-hidden bg-slate-950 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]" : "w-full"}
          data-native-fullscreen={nativeFullscreen}
        >
          <PlayerGigStageSurface
            canvas={playerCanvas}
            controls={playerControls}
            snapshot={snapshot}
            songCount={story.songs.length}
            fullscreen={fullscreen}
          />
        </div>
      </GigViewerErrorBoundary>
    );
  }

  const canvas = (
    <GigCanvas
      replay={replay}
      experience={experience}
      playbackState={state}
      reducedMotion={reducedMotion}
      pyrotechnics={pyrotechnics}
      cameraMode={cameraMode}
      fill={fullscreen}
      className={fullscreen ? "h-full min-h-0 w-full" : "w-full"}
    />
  );

  if (fullscreen) {
    return (
      <GigViewerErrorBoundary onResult={resultAction} onClose={onClose} resetKey={`${replay.id}:fullscreen`}>
        <div
          ref={popoutRef}
          className="fixed inset-0 z-[70] flex h-[100dvh] w-screen flex-col gap-2 overflow-hidden bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen gig stage analysis"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 pr-12 sm:pr-0">
            <h2 className="truncate text-sm font-semibold sm:text-lg">
              {experience?.gig?.venue?.name ?? "Gig replay"} · {StageTypeLabels[stageType]}
            </h2>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {snapshot.crowdMoodLabel} · energy {Math.round(snapshot.crowdEnergy)}
            </span>
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={toggleFullscreen}
            aria-label="Exit full screen stage analysis"
            className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 h-11 w-11 rounded-full shadow-lg"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="min-h-0 flex-1">{canvas}</div>
          <div className="shrink-0 space-y-2">
            <div className="sm:hidden">
              <span className="text-xs text-muted-foreground">
                {snapshot.crowdMoodLabel} · energy {Math.round(snapshot.crowdEnergy)}
              </span>
            </div>
            <GigCurrentSongPanel snapshot={snapshot} />
            <div className="sm:hidden">{compactControls}</div>
            <div className="hidden sm:block">{analysisControls}</div>
          </div>
        </div>
      </GigViewerErrorBoundary>
    );
  }

  return (
    <GigViewerErrorBoundary onResult={resultAction} onClose={onClose} resetKey={replay.id}>
      <div ref={popoutRef}>
        <Card>
          <CardHeader>
            <CardTitle>{resultAction ? "Gig Replay" : "Gig Viewer"} · {StageTypeLabels[stageType]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysisControls}
            <GigViewerAudioControls audio={audio} />
            <GigViewerStatus
              state={state}
              attendance={metricNumber(experience?.headline.attendance)}
              capacity={experience?.gig.venue.capacity}
              replay={replay}
              reducedMotion={reducedMotion}
            />
            <GigCurrentSongPanel snapshot={snapshot} />
            {empty ? (
              <GigViewerFallback
                title="Empty event sequence"
                body="The presentation contains no events. Retry later or use the authoritative report when it is ready."
                onResult={resultAction}
                onClose={onClose}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
                <div className="space-y-4">
                  {canvas}
                  <GigResultRevealOverlay
                    visible={snapshot.resultVisible}
                    experience={experience}
                    story={story}
                    onResult={onViewResult}
                    onRestart={playback.restart}
                    onClose={onClose}
                  />
                  <GigCrowdMoodGraph story={story} positionMs={state.positionMs} onSeek={playback.seekMs} />
                </div>
                <div className="space-y-4">
                  <GigPerformerPanel
                    replay={replay}
                    experience={experience}
                    playbackState={state}
                    reducedMotion={reducedMotion}
                  />
                  <GigViewerTimeline
                    events={playback.events}
                    activeId={state.activeEvent?.id}
                    completedIds={state.completedEventIds}
                    onSelect={playback.seekToEvent}
                    story={story}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GigViewerErrorBoundary>
  );
}

function metricNumber(metric: { status?: string; value?: unknown } | undefined): number | null {
  return metric?.status === "available" && typeof metric.value === "number" ? metric.value : null;
}
