import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListVideo, PauseCircle, PlayCircle, SkipBack, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getTotpEpisodePresenterAudio, getTotpEpisodePresenterFragments, type TotpBroadcastReplay, type TotpPresenterFragmentBundle } from "./api";
import { getTotpBandNameAudioCatalog } from "./bandNameAudioApi";
import { supabase } from "@/integrations/supabase/client";
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
import {
  buildTotpContinuityCopy,
  orderTotpProgrammeReplays,
  totpContinuitySpeech,
  type TotpContinuityKind,
} from "./programmeContinuity";
import { canonicalise, manifestChecksum } from "./episodeManifest";
import { TOTP_CHART_PRESENTER_LINE } from "./presenterDialogue";
import { matchTotpReusablePresenterPhrase } from "./presenterPhraseAudio";
import { TOTP_MEDIA_BUCKET, TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";
import type { TotpPresenterRecordedClip } from "./presenterVoice";

export interface TotpFullEpisodePlayerProps {
  replays: TotpBroadcastReplay[];
  chartRundown?: TotpChartRundown | null;
}

export function orderTotpEpisodeReplays(replays: TotpBroadcastReplay[]): TotpBroadcastReplay[] {
  return orderTotpProgrammeReplays(replays);
}


function stableAudioIndex(value: string, length: number): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % Math.max(1, length);
}

function phraseClip(
  fragments: TotpPresenterFragmentBundle | null | undefined,
  ids: string[],
  stableKey: string,
  gapAfterMs = 70,
): TotpPresenterRecordedClip | null {
  if (!fragments) return null;
  const available = ids
    .map((id) => ({ id, asset: fragments.phrases?.[id] }))
    .filter((item): item is { id: string; asset: { storage_path: string; uploaded_at?: string | null } } => !!item.asset?.storage_path);
  if (!available.length) return null;
  const chosen = available[stableAudioIndex(stableKey, available.length)];
  return { url: totpMediaPublicUrl(chosen.asset.storage_path), gapAfterMs };
}

function bandClip(
  replay: TotpBroadcastReplay,
  fragments: TotpPresenterFragmentBundle | null | undefined,
  gapAfterMs = 90,
): TotpPresenterRecordedClip | null {
  const asset = fragments?.bands?.[replay.payload.band.id];
  if (!asset?.audio_url) return null;
  const recorded = asset.band_name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const current = replay.payload.band.name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return recorded === current ? { url: asset.audio_url, gapAfterMs } : null;
}

export function buildTotpBetweenPresenterSequence(
  current: TotpBroadcastReplay,
  next: TotpBroadcastReplay,
  fragments: TotpPresenterFragmentBundle | null | undefined,
): TotpPresenterRecordedClip[] | null {
  if (!fragments) return null;
  const currentBand = bandClip(current, fragments, 120);
  const nextBand = bandClip(next, fragments, 0);
  if (!currentBand && !nextBand) return null;

  const reaction = currentBand
    ? phraseClip(
        fragments,
        ["what-a-performance-from", "another-big-hand-for", "hear-it-for", "that-was", "fantastic-stuff-from", "give-it-up-for"],
        `post:${current.performance_id}:${current.payload.band.id}`,
        65,
      )
    : null;
  const handoff = nextBand
    ? phraseClip(
        fragments,
        ["up-next-its", "and-now-its", "next-on-stage", "studio-ready-for", "here-we-go-with", "crowd-ready-for", "live-tonight", "please-welcome"],
        `next:${next.performance_id}:${next.payload.band.id}`,
        65,
      )
    : null;

  const clips = [reaction, currentBand, handoff, nextBand].filter(
    (clip): clip is TotpPresenterRecordedClip => Boolean(clip),
  );
  return clips.length ? clips : null;
}

export function buildTotpActPresenterSequence(
  replay: TotpBroadcastReplay,
  script: string,
  fragments: TotpPresenterFragmentBundle | null | undefined,
): TotpPresenterRecordedClip[] | null {
  if (!fragments) return null;
  const bandAsset = fragments.bands?.[replay.payload.band.id];
  if (!bandAsset?.audio_url) return null;

  const normalizedRecordedName = bandAsset.band_name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const normalizedCurrentName = replay.payload.band.name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  if (normalizedRecordedName !== normalizedCurrentName) return null;

  const matchedPhrase = script.trim()
    ? matchTotpReusablePresenterPhrase(script, replay.payload.band.name)
    : null;
  const fallbackPhraseIds = [
    "up-next-its",
    "and-now-its",
    "please-welcome",
    "time-for",
    "studio-ready-for",
    "here-we-go-with",
    "coming-live-from",
    "next-on-stage",
    "crowd-ready-for",
    "live-tonight",
    "take-it-away",
  ];
  const availableFallbacks = fallbackPhraseIds.filter((id) => !!fragments.phrases?.[id]?.storage_path);
  let hash = 2166136261;
  for (const character of `${replay.performance_id}:${replay.payload.runningOrder}:${replay.payload.band.id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const selectedPhraseId = matchedPhrase?.id
    ?? availableFallbacks[(hash >>> 0) % Math.max(1, availableFallbacks.length)]
    ?? null;
  if (!selectedPhraseId) return [{ url: bandAsset.audio_url, gapAfterMs: 0 }];

  const phraseAsset = fragments.phrases?.[selectedPhraseId];
  if (!phraseAsset?.storage_path) return [{ url: bandAsset.audio_url, gapAfterMs: 0 }];
  return [
    { url: totpMediaPublicUrl(phraseAsset.storage_path), gapAfterMs: 70 },
    { url: bandAsset.audio_url, gapAfterMs: 0 },
  ];
}


async function loadTotpDemoPresenterFragments(presenterKey: string): Promise<TotpPresenterFragmentBundle> {
  const [bands, phraseListing] = await Promise.all([
    getTotpBandNameAudioCatalog(),
    supabase.storage.from(TOTP_MEDIA_BUCKET).list(TOTP_MEDIA_PATHS.reusablePhraseFolder(presenterKey), { limit: 500 }),
  ]);
  if (phraseListing.error) throw new Error(phraseListing.error.message);

  const newest = new Map<string, { storage_path: string; uploaded_at: string | null; stamp: number }>();
  for (const item of phraseListing.data ?? []) {
    const match = /^([a-z0-9-]+)-([a-f0-9]{8,64})\.(mp3|wav|ogg|webm|m4a|mp4)$/i.exec(item.name);
    if (!match) continue;
    const id = match[1];
    const uploadedAt = item.created_at ?? item.updated_at ?? null;
    const stamp = Date.parse(uploadedAt ?? "") || 0;
    const current = newest.get(id);
    if (!current || stamp >= current.stamp) {
      newest.set(id, {
        storage_path: `${TOTP_MEDIA_PATHS.reusablePhraseFolder(presenterKey)}/${item.name}`,
        uploaded_at: uploadedAt,
        stamp,
      });
    }
  }

  return {
    presenter_key: presenterKey,
    phrases: Object.fromEntries([...newest.entries()].map(([id, asset]) => [id, {
      storage_path: asset.storage_path,
      uploaded_at: asset.uploaded_at,
    }])),
    bands: Object.fromEntries(
      bands
        .filter((band) => band.status === "recorded" && !!band.audio_url)
        .map((band) => [band.band_id, {
          band_id: band.band_id,
          band_name: band.band_name,
          audio_url: band.audio_url!,
          duration_ms: Number(band.duration_ms ?? 0),
          sha256: band.sha256 ?? "",
          version: Number(band.version ?? 1),
        }]),
    ),
  };
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
  const episodeId = ordered[0]?.payload.episodeId ?? null;
  const episodeIdIsPersisted = !!episodeId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(episodeId);
  const presenterAudioQuery = useQuery({
    queryKey: ["totp", "presenter-audio", episodeId],
    queryFn: () => getTotpEpisodePresenterAudio(episodeId!),
    enabled: episodeIdIsPersisted,
    staleTime: 60_000,
  });
  const presenterAudio = presenterAudioQuery.data ?? {};
  const presenterFragmentsQuery = useQuery({
    queryKey: ["totp", "presenter-fragments", episodeId],
    queryFn: () => getTotpEpisodePresenterFragments(episodeId!),
    enabled: episodeIdIsPersisted,
    staleTime: 60_000,
  });
  const demoPresenterKey = current?.payload.presenterKey ?? current?.presenter_key ?? "alex_rayne";
  const demoPresenterFragmentsQuery = useQuery({
    queryKey: ["totp", "presenter-fragments-library", demoPresenterKey],
    queryFn: () => loadTotpDemoPresenterFragments(demoPresenterKey),
    enabled: !episodeIdIsPersisted && !!current,
    staleTime: 60_000,
  });
  const presenterFragments = presenterFragmentsQuery.data ?? demoPresenterFragmentsQuery.data ?? null;

  const exactPresenterUrl = (key: string, script: string): string | null => {
    if (!script.trim()) return null;
    const asset = presenterAudio[key];
    if (!asset?.audio_url) return null;
    const expected = manifestChecksum(canonicalise(script));
    return asset.script_checksum === expected ? asset.audio_url : null;
  };

  const continuityScript = current && continuityKind
    ? totpContinuitySpeech(buildTotpContinuityCopy(continuityKind, ordered, currentIndex))
    : "";
  const continuityPlanKey = continuityKind === "opening"
    ? "cue:opening"
    : continuityKind === "closing"
      ? "cue:closing"
      : `cue:between:${current?.performance_id ?? "none"}`;
  const actPresenterScript = current?.payload.cues.find(
    (cue) => cue.type === "presenter" && !!cue.presenterText,
  )?.presenterText ?? "";
  const actPresenterSequence = useMemo(
    () => current ? buildTotpActPresenterSequence(current, actPresenterScript, presenterFragments) : null,
    [actPresenterScript, current, presenterFragments],
  );
  const nextReplay = ordered[currentIndex + 1] ?? null;
  const nextActPresenterSequence = useMemo(
    () => current && nextReplay
      ? buildTotpBetweenPresenterSequence(current, nextReplay, presenterFragments)
      : null,
    [current, nextReplay, presenterFragments],
  );

  if (!current) return null;

  const completedActs = currentIndex;
  const programmeProgress = ordered.length > 0 ? (completedActs / ordered.length) * 100 : 0;
  const fullEpisodeRunning = showClock || showIntro || showChartRundown || showStageTransition || showCredits || continuityKind !== null || continuous;
  const segmentKey = showClock
    ? "clock"
    : showIntro
      ? "intro"
      : showStageTransition
        ? `transition:${currentIndex}`
        : continuityKind
          ? `continuity:${continuityKind}:${currentIndex}`
          : showChartRundown
            ? "chart-rundown"
            : showCredits
              ? "credits"
              : `act:${current.id}`;

  const goTo = (index: number) => {
    setShowClock(false);
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
    setShowIntro(false);
    setShowChartRundown(false);
    setShowStageTransition(false);
    setShowCredits(false);
    setContinuityKind(null);
    setContinuous(false);
    setShowClock(true);
  };

  const stopFullEpisode = () => {
    setShowClock(false);
    setShowIntro(false);
    setShowChartRundown(false);
    setShowStageTransition(false);
    setShowCredits(false);
    setContinuityKind(null);
    setContinuous(false);
  };

  const finishClock = () => {
    setShowClock(false);
    setShowIntro(true);
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
              {showClock
                ? "Counting down"
                : showCredits
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
        <Progress value={showClock || showIntro ? 0 : programmeProgress} className="mt-3 h-1.5" />
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

      <TotpSegmentFade segmentKey={segmentKey}>
        {showClock ? (
          <TotpCountdownClock onEnded={finishClock} />
        ) : showIntro ? (
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
            recordedUrl={exactPresenterUrl(continuityPlanKey, continuityScript)}
            recordedSequence={continuityKind === "between" ? nextActPresenterSequence : null}
            onEnded={finishContinuity}
          />
        ) : showChartRundown && chartRundown ? (
          <TotpChartRundownSequence
            rundown={chartRundown}
            autoPlay={continuous}
            presenterKey={current.payload.presenterKey ?? current.presenter_key}
            recordedUrl={exactPresenterUrl("cue:chart", TOTP_CHART_PRESENTER_LINE)}
            presenterFragments={presenterFragments}
            onEnded={finishChartRundown}
          />
        ) : showCredits ? (
          <TotpEndCredits replays={ordered} autoPlay onEnded={finishCredits} />
        ) : (
          <TotpArchivePlayer
            key={`${current.id}:${continuous ? "auto" : "manual"}`}
            replay={current}
            autoPlay={continuous}
            presenterRecordedUrl={exactPresenterUrl(current.performance_id, actPresenterScript)}
            presenterRecordedSequence={actPresenterSequence}
            onEnded={continuous ? finishAct : undefined}
          />
        )}
      </TotpSegmentFade>

      {!showClock && !showIntro && !showChartRundown && !showStageTransition && !showCredits && continuityKind === null && !continuous ? (
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
