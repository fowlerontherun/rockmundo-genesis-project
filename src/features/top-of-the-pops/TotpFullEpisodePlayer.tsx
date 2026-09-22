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

export function buildTotpActPresenterSequence(
  replay: TotpBroadcastReplay,
  script: string,
  fragments: TotpPresenterFragmentBundle | null | undefined,
): TotpPresenterRecordedClip[] | null {
  if (!fragments || !script.trim()) return null;
  const phrase = matchTotpReusablePresenterPhrase(script, replay.payload.band.name);
  if (!phrase) return null;

  const phraseAsset = fragments.phrases?.[phrase.id];
  const bandAsset = fragments.bands?.[replay.payload.band.id];
  if (!phraseAsset?.storage_path || !bandAsset?.audio_url) return null;
  if (bandAsset.band_name !== replay.payload.band.name) return null;

  return [
    { url: totpMediaPublicUrl(phraseAsset.storage_path), gapAfterMs: 65 },
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
            onEnded={finishContinuity}
          />
        ) : showChartRundown && chartRundown ? (
          <TotpChartRundownSequence
            rundown={chartRundown}
            autoPlay={continuous}
            presenterKey={current.payload.presenterKey ?? current.presenter_key}
            recordedUrl={exactPresenterUrl("cue:chart", TOTP_CHART_PRESENTER_LINE)}
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
