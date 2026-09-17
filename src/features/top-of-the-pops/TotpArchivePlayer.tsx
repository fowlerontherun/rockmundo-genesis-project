import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GigViewerReplay } from "@/features/gig-experience/events/types";
import type { GigExperienceDTO } from "@/features/gig-experience/types";
import { derivePlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import type { TotpBroadcastReplay } from "./api";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { TotpBroadcastCanvas } from "./TotpBroadcastCanvas";
import { totpAudienceReactionLabel } from "./studioAudience";

const metric = <T,>(value: T) => ({ status: "available" as const, value, source: "authoritative" as const });
const unavailable = (reason: string) => ({ status: "not_applicable" as const, reason });

function lockedAudienceReaction(source: TotpBroadcastReplay): number {
  const value = Number((source.payload as any)?.liveTv?.audienceReaction ?? 0);
  return Number.isFinite(value) ? Math.max(-10, Math.min(10, value)) : 0;
}

function archivedReplay(source: TotpBroadcastReplay): GigViewerReplay {
  const payload = source.payload;
  const audienceReaction = lockedAudienceReaction(source);
  const baseCrowdEnergy = Math.max(28, Math.min(62, 44 + audienceReaction * 2));
  const performanceCrowdEnergy = Math.max(50, Math.min(92, 70 + audienceReaction * 3));
  const songStart = 7_000;
  const songEnd = songStart + payload.performanceDurationMs;
  let sequence = 0;
  const event = (partial: any) => ({
    id: `${source.id}:${++sequence}`,
    gigId: `totp:${payload.performanceId}`,
    sequence,
    durationMs: 1_000,
    importance: "normal",
    messageKey: "totp.archive",
    messageParams: {},
    ...partial,
  });

  const members = payload.band.members.length > 0
    ? payload.band.members
    : [{ profile_id: `totp-placeholder:${payload.band.id}`, display_name: payload.band.name, role: "performer" }];

  const events: any[] = [
    event({
      phase: "venue_opening",
      eventType: "venue_opened",
      scheduledOffsetMs: 0,
      durationMs: 3_000,
      visualPayload: { type: "venue_open", entranceIds: ["studio"], lightLevel: .35 },
    }),
    event({
      phase: "crowd_entry",
      eventType: "crowd_arrived",
      scheduledOffsetMs: 0,
      durationMs: 5_000,
      crowdEnergyBefore: Math.max(20, baseCrowdEnergy - 10),
      crowdEnergyAfter: baseCrowdEnergy,
      visualPayload: { type: "crowd_fill", targetDensity: .92, zoneIds: ["studio_floor"], enteringCount: 220 },
    }),
  ];

  members.forEach((member, index) => {
    const performerId = member.profile_id || `totp-member:${index}`;
    events.push(event({
      phase: "band_entrance",
      eventType: "performer_entered",
      scheduledOffsetMs: 1_000 + index * 180,
      durationMs: 1_600,
      performerProfileId: performerId,
      visualPayload: {
        type: "performer_enter",
        performerId,
        displayName: member.display_name,
        roleOrInstrument: member.instrument_role || member.vocal_role || member.role || "performer",
        startPosition: { x: 600, y: 520, zone: "back_center" },
      },
    }));
  });

  events.push(event({
    phase: "song_intro",
    eventType: "song_started",
    scheduledOffsetMs: songStart,
    durationMs: payload.performanceDurationMs,
    songId: payload.song.id,
    crowdEnergyBefore: baseCrowdEnergy,
    crowdEnergyAfter: performanceCrowdEnergy,
    visualPayload: {
      type: "song_start",
      songId: payload.song.id,
      title: payload.song.title,
      position: 1,
      montage: false,
      itemType: "song",
    },
  }));

  events.push(event({
    phase: "finale",
    eventType: "band_exited",
    scheduledOffsetMs: songEnd,
    durationMs: 4_000,
    visualPayload: {
      type: "band_exit",
      exitStyle: "wave",
      performerIds: members.map((member, index) => member.profile_id || `totp-member:${index}`),
    },
  }));

  return {
    id: source.id,
    gigId: `totp:${payload.performanceId}`,
    gigOutcomeId: `totp:${payload.performanceId}`,
    viewerVersion: 1,
    eventSchemaVersion: 1,
    simulationSeed: source.checksum,
    durationMs: payload.totalDurationMs,
    generatedAt: source.generated_at,
    events,
    checksum: source.checksum,
    status: "ready",
    resultAvailable: false,
  } as GigViewerReplay;
}

function archivedExperience(source: TotpBroadcastReplay): GigExperienceDTO {
  const payload = source.payload;
  const audienceReaction = lockedAudienceReaction(source);
  const crowdPeak = Math.max(50, Math.min(92, 70 + audienceReaction * 3));
  return {
    schemaVersion: 1,
    gig: {
      id: `totp:${payload.performanceId}`,
      bandId: payload.band.id,
      status: "completed",
      scheduledDate: payload.episodeDate,
      startedAt: payload.broadcastAt,
      completedAt: payload.broadcastAt,
      ticketPrice: metric(0),
      venue: {
        id: "totp-tv-studio",
        name: "RockMundo Television Centre",
        location: "London",
        capacity: 250,
        type: "tv_studio",
      },
    },
    headline: {
      overallRating: unavailable("Broadcast archive"),
      performanceGrade: unavailable("Broadcast archive"),
      verdict: `Archived Top of the Pops television performance · ${totpAudienceReactionLabel(audienceReaction)} studio audience`,
      attendance: metric(220),
      capacity: metric(250),
      netProfit: metric(0),
      fameGained: unavailable("Rewards are not replayed"),
      fansGained: unavailable("Rewards are not replayed"),
      bestSongTitle: metric(payload.song.title),
    },
    songs: [],
    performers: payload.band.members.map((member, index) => ({
      id: member.profile_id || `totp-member:${index}`,
      profileId: member.profile_id || `totp-member:${index}`,
      displayName: member.display_name,
      roleOrInstrument: member.instrument_role || member.vocal_role || member.role || "performer",
      lineupStatus: "performed",
    })),
    finances: {
      ticketRevenue: metric(0), merchRevenue: metric(0), totalRevenue: metric(0), crewCosts: metric(0),
      equipmentWearCost: metric(0), venueCost: metric(0), totalCosts: metric(0), netProfit: metric(0), merchItemsSold: metric(0),
    },
    progression: {
      fameGained: unavailable("Rewards are not replayed"), chemistryChange: unavailable("Broadcast archive"),
      totalXpAwarded: unavailable("Rewards are not replayed"), fansGained: unavailable("Rewards are not replayed"), fanConversions: unavailable("Rewards are not replayed"),
    },
    analysis: {
      equipmentQuality: unavailable("Broadcast archive"), crewSkill: unavailable("Broadcast archive"), bandChemistry: unavailable("Broadcast archive"),
      memberSkills: unavailable("Broadcast archive"), crowdEnergyPeak: metric(crowdPeak), stageBehaviorUsed: unavailable("Broadcast archive"), gearEffects: null, warnings: [],
    },
    postConsequences: {
      processingStatus: "skipped", processingVersion: null, processedAt: null,
      liveReputationDelta: unavailable("Broadcast archive"), fanDelta: unavailable("Broadcast archive"), followerDelta: unavailable("Broadcast archive"),
      bookingDemandDelta: unavailable("Broadcast archive"), mediaCoverage: unavailable("Broadcast archive"), timeline: [], nextActions: [], consequences: [],
    },
    lessons: { worked: [], heldBack: [], recommendations: [] },
    viewer: { ready: true, outcomeId: null, resultReadyAt: null, replayAvailable: true, replay: { viewerVersion: 1, durationMs: payload.totalDurationMs, generationStatus: "ready" } },
  } as GigExperienceDTO;
}

function activeCue(cues: TotpBroadcastCue[], positionMs: number): TotpBroadcastCue | null {
  const active = cues.filter((cue) => positionMs >= cue.offsetMs && positionMs < cue.offsetMs + cue.durationMs);
  return active.at(-1) ?? cues.filter((cue) => cue.offsetMs <= positionMs).at(-1) ?? cues[0] ?? null;
}

export function TotpArchivePlayer({ replay: source }: { replay: TotpBroadcastReplay }) {
  const replay = useMemo(() => archivedReplay(source), [source]);
  const experience = useMemo(() => archivedExperience(source), [source]);
  const audienceReaction = useMemo(() => lockedAudienceReaction(source), [source]);
  const [positionMs, setPositionMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playback = useMemo(() => derivePlaybackState(replay, positionMs, playing), [replay, positionMs, playing]);
  const cue = useMemo(() => activeCue(source.payload.cues, positionMs), [source.payload.cues, positionMs]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = now - previous;
      previous = now;
      setPositionMs((current) => {
        const next = Math.min(replay.durationMs, current + elapsed);
        if (next >= replay.durationMs) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, replay.durationMs]);

  const progress = Math.min(100, positionMs / Math.max(1, replay.durationMs) * 100);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3" data-totp-archive-player>
      <div className="aspect-video min-h-[28rem] overflow-hidden rounded-lg bg-slate-950">
        <TotpBroadcastCanvas
          replay={replay}
          experience={experience}
          playbackState={playback}
          cue={cue}
          audienceReaction={audienceReaction}
          className="h-full min-h-[28rem] w-full"
        />
      </div>
      <div className="space-y-2">
        <Progress value={progress} className="h-1.5" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPositionMs(0); setPlaying(false); }}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restart
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {totpAudienceReactionLabel(audienceReaction)} audience · checksum {source.checksum.slice(0, 8)} · replay v{source.replay_version}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TotpArchivePlayer;
