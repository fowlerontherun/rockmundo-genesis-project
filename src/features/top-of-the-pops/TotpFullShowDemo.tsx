import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileAudio2, ListVideo, ShieldCheck, Users } from "lucide-react";
import { TotpFullEpisodePlayer } from "./TotpFullEpisodePlayer";
import type { TotpChartRundown } from "./chartRundownApi";
import type { TotpTestPreviewPerformance } from "./testPreviewApi";
import { getTotpBandNameAudioCatalog } from "./bandNameAudioApi";
import { loadTotpCrowdSounds } from "./crowdSoundLibrary";
import { TOTP_MEDIA_BUCKET, TOTP_MEDIA_PATHS } from "./totpMedia";
import {
  buildTotpTestReplay,
  combineTotpTestEffects,
  getTotpTestIncident,
  getTotpTestStyleOutcome,
} from "./testLifecycle";

export function TotpFullShowDemo({
  performances,
  seed,
  generatedAt,
  chartRundown,
  onExit,
}: {
  performances: TotpTestPreviewPerformance[];
  seed: string;
  generatedAt: string;
  chartRundown?: TotpChartRundown | null;
  onExit: () => void;
}) {

  const audioCoverageQuery = useQuery({
    queryKey: ["totp", "demo-audio-coverage"],
    queryFn: async () => {
      const presenterKey = "alex_rayne";
      const [bands, crowd, phrasesResult, positionsResult] = await Promise.all([
        getTotpBandNameAudioCatalog(),
        loadTotpCrowdSounds(),
        supabase.storage.from(TOTP_MEDIA_BUCKET).list(TOTP_MEDIA_PATHS.reusablePhraseFolder(presenterKey), { limit: 500 }),
        supabase.storage.from(TOTP_MEDIA_BUCKET).list(TOTP_MEDIA_PATHS.chartPositionFolder(presenterKey), { limit: 200 }),
      ]);
      if (phrasesResult.error) throw new Error(phrasesResult.error.message);
      if (positionsResult.error) throw new Error(positionsResult.error.message);

      const recordedBandIds = new Set(
        bands
          .filter((band) => band.status === "recorded" && !!band.audio_url)
          .map((band) => band.band_id),
      );
      const reusablePhraseIds = new Set(
        (phrasesResult.data ?? [])
          .map((item) => /^([a-z0-9-]+)-[a-f0-9]{8,64}\.(mp3|wav|ogg|webm|m4a|mp4)$/i.exec(item.name)?.[1] ?? null)
          .filter((value): value is string => !!value),
      );
      const chartPositions = new Set(
        (positionsResult.data ?? [])
          .map((item) => /^(\d+)-[a-f0-9]{8,64}\.(mp3|wav|ogg|webm|m4a|mp4)$/i.exec(item.name)?.[1] ?? null)
          .filter((value): value is string => !!value)
          .map(Number)
          .filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= 40),
      );
      return {
        recordedBandIds,
        reusablePhraseCount: reusablePhraseIds.size,
        chartPositionCount: chartPositions.size,
        crowdCount: crowd.length,
        crowdTypes: [...new Set(crowd.map((sound) => sound.sound_type))],
      };
    },
    staleTime: 30_000,
  });

  const bookedBandIds = useMemo(() => new Set(performances.map((performance) => performance.band_id)), [performances]);
  const bookedBandAudioCount = audioCoverageQuery.data
    ? [...bookedBandIds].filter((bandId) => audioCoverageQuery.data.recordedBandIds.has(bandId)).length
    : 0;
  const missingBandAudio = audioCoverageQuery.data
    ? performances
        .filter((performance) => !audioCoverageQuery.data.recordedBandIds.has(performance.band_id))
        .map((performance) => performance.band_name)
    : [];

  const replays = useMemo(
    () => {
      const ordered = performances.slice().sort((a, b) => a.running_order - b.running_order);
      const distinctStages = new Set(ordered.map((performance) => performance.stage_key)).size;
      const demoStageCycle = ["main_stage", "stage_b", "studio_floor", "rock_stage"] as const;
      return ordered.map((performance, index) => {
        const bookedPerformance = {
          ...performance,
          running_order: index + 1,
          stage_key: distinctStages <= 1 ? demoStageCycle[index % demoStageCycle.length] : performance.stage_key,
        };
        const style = getTotpTestStyleOutcome(seed, bookedPerformance, "polished");
        const incident = getTotpTestIncident(seed, bookedPerformance);
        const audienceReaction = combineTotpTestEffects(
          incident.effects,
          style?.effects ?? { reputation: 0, fan_sentiment: 0, media_intensity: 0, audience_reaction: 0 },
        ).audience_reaction;
        return buildTotpTestReplay(bookedPerformance, seed, generatedAt, audienceReaction);
      });
    },
    [generatedAt, performances, seed],
  );

  return (
    <Card className="border-primary/30 bg-primary/[0.03]" data-totp-full-show-demo>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListVideo className="h-5 w-5" /> Booked full-show demo
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              This runs the complete mock programme using the booked demo lineup: countdown, titles, presenter links,
              stage transitions, performances, chart rundown and credits. Song titles stay on screen; presenter speech
              is band-led. Nothing in this preview creates invitations, rewards, history or progression.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> zero gameplay writes
            </Badge>
            <Badge variant="secondary">{performances.length} booked acts</Badge>
            <Button size="sm" variant="outline" onClick={onExit}>Edit demo booking</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-3" data-totp-demo-audio-coverage>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Audio coverage</span>
            {audioCoverageQuery.isLoading ? (
              <Badge variant="outline">checking…</Badge>
            ) : audioCoverageQuery.isError ? (
              <Badge variant="destructive">coverage check failed</Badge>
            ) : (
              <>
                <Badge variant={bookedBandAudioCount === bookedBandIds.size ? "secondary" : "destructive"}>
                  <FileAudio2 className="mr-1 h-3 w-3" /> band names {bookedBandAudioCount}/{bookedBandIds.size}
                </Badge>
                <Badge variant={Number(audioCoverageQuery.data?.reusablePhraseCount ?? 0) > 0 ? "secondary" : "destructive"}>
                  presenter phrases {audioCoverageQuery.data?.reusablePhraseCount ?? 0}
                </Badge>
                <Badge variant={audioCoverageQuery.data?.chartPositionCount === 40 ? "secondary" : "outline"}>
                  chart positions {audioCoverageQuery.data?.chartPositionCount ?? 0}/40
                </Badge>
                <Badge variant={Number(audioCoverageQuery.data?.crowdCount ?? 0) > 0 ? "secondary" : "destructive"}>
                  <Users className="mr-1 h-3 w-3" /> crowd clips {audioCoverageQuery.data?.crowdCount ?? 0}
                </Badge>
              </>
            )}
          </div>
          {missingBandAudio.length > 0 ? (
            <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Missing current band-name audio: {missingBandAudio.join(", ")}
            </div>
          ) : null}
          {audioCoverageQuery.data && audioCoverageQuery.data.crowdCount <= 1 ? (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Crowd library is very small ({audioCoverageQuery.data.crowdTypes.join(", ") || "no active types"}). Playback will reuse the available recording plus generated studio ambience.
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {performances
            .slice()
            .sort((a, b) => a.running_order - b.running_order)
            .map((performance) => (
              <Badge key={`${performance.band_id}:${performance.song_id}`} variant="outline">
                {performance.running_order}. {performance.band_name}
              </Badge>
            ))}
        </div>
        <TotpFullEpisodePlayer replays={replays} chartRundown={chartRundown ?? null} />
      </CardContent>
    </Card>
  );
}

export default TotpFullShowDemo;
