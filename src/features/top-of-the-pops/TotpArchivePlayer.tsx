import { useEffect, useMemo, useRef, useState } from "react";
import { Captions, CaptionsOff, CloudUpload, Download, Mic, Pause, Play, RotateCcw, Video, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GigViewerReplay } from "@/features/gig-experience/events/types";
import type { GigExperienceDTO } from "@/features/gig-experience/types";
import { derivePlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import { appearanceFromLegacy, resolveAppearance } from "@/features/player-model/appearance";
import type { GigPlayerModelsData } from "@/features/player-model/usePlayerModel";
import { resolveEquippedClothingVisual } from "@/features/clothing-preview/equippedClothing";
import { getTotpPerformanceAudio, type TotpBroadcastReplay } from "./api";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { buildTotpCaptionCues } from "./broadcastCaptions";
import { clampTotpGain, totpMixLevels } from "./broadcastAudioMix";
import { resolveTotpPresenter, totpVariantLabel } from "./presenters";
import { TotpBroadcastCanvas } from "./TotpBroadcastCanvas";
import { TotpBroadcastRecoveryBoundary } from "./TotpBroadcastRecoveryBoundary";
import { totpAudienceReactionLabel } from "./studioAudience";
import { TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";
import { downloadTotpExport, recordTotpBroadcast, TOTP_EXPORT_PROFILE, totpExportFileName, TotpExportUnsupportedError } from "./exportBroadcast";
import { TOTP_EXPORT_LEAD_IN_MS, totpCountdownSeconds } from "./broadcastCountdown";
import { cancelTotpPresenterSpeech, playTotpPresenterLine, type TotpPresenterLineHandle } from "./presenterVoice";

const metric = <T,>(value: T) => ({ status: "available" as const, value, source: "authoritative" as const });
const unavailable = (reason: string) => ({ status: "not_applicable" as const, reason });

type ReplayEvent = GigViewerReplay["events"][number];
type AppearanceInput = Parameters<typeof resolveAppearance>[0];
type LegacyAppearanceInput = Parameters<typeof appearanceFromLegacy>[0];
type ClothingItemInput = Parameters<typeof resolveEquippedClothingVisual>[0];
type ClothingVariantInput = Parameters<typeof resolveEquippedClothingVisual>[1];
type ClothingCustomizationInput = Parameters<typeof resolveEquippedClothingVisual>[2];

export function lockedAudienceReaction(source: TotpBroadcastReplay): number {
  const value = Number(source.payload.liveTv?.audienceReaction ?? 0);
  return Number.isFinite(value) ? Math.max(-10, Math.min(10, value)) : 0;
}
export function lockedPresenterKey(source: TotpBroadcastReplay): string { return String(source.payload.presenterKey ?? source.presenter_key ?? "alex_rayne"); }
export function lockedShowVariant(source: TotpBroadcastReplay): string { return String(source.payload.showVariant ?? "regular"); }

export function totpPerformanceStartMs(source: TotpBroadcastReplay): number {
  const offsets = source.payload.cues
    .filter((cue) => cue.type === "performance")
    .map((cue) => Number(cue.offsetMs))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return offsets.length > 0 ? Math.min(...offsets) : 4_200;
}

export function memberStageDuty(member: TotpBroadcastReplay["payload"]["band"]["members"][number], members: TotpBroadcastReplay["payload"]["band"]["members"]): string {
  const instrument = member.instrument_role?.trim() || "";
  const explicitVocal = member.vocal_role?.trim() || "";
  const anyExplicitSinger = members.some((candidate) => !!candidate.vocal_role?.trim());
  const nonDrummer = !/drum|percussion/i.test(instrument || member.role || "");
  const fallbackSinger = !anyExplicitSinger
    ? members.find((candidate) => candidate.profile_id && !/drum|percussion/i.test(candidate.instrument_role || candidate.role || ""))
      ?? members.find((candidate) => !/drum|percussion/i.test(candidate.instrument_role || candidate.role || ""))
      ?? null
    : null;
  const vocal = explicitVocal || (fallbackSinger === member && nonDrummer ? "Lead Vocals" : "");
  return [instrument, vocal].filter(Boolean).join(" / ") || member.role || "performer";
}

/** Decode replay-v4 render snapshots into the exact shape consumed by the shared Gig Viewer. */
export function archivedPlayerModels(source: TotpBroadcastReplay): GigPlayerModelsData | null {
  const appearances: GigPlayerModelsData["appearances"] = {};
  const richClothing: GigPlayerModelsData["richClothing"] = {};
  let frozen = 0;
  for (const member of source.payload.band.members) {
    const profileId = member.profile_id ? String(member.profile_id) : "";
    const snapshot = member.visual_snapshot;
    if (!profileId || !snapshot) continue;
    if (snapshot.appearance) appearances[profileId] = resolveAppearance(snapshot.appearance as AppearanceInput, profileId);
    else if (snapshot.legacyAvatar) appearances[profileId] = appearanceFromLegacy(snapshot.legacyAvatar as LegacyAppearanceInput, profileId);
    richClothing[profileId] = Array.isArray(snapshot.richClothing)
      ? snapshot.richClothing
          .filter((row) => row.item)
          .map((row) => resolveEquippedClothingVisual(
            row.item as ClothingItemInput,
            row.selectedVariantKey as ClothingVariantInput,
            row.customizationConfig as ClothingCustomizationInput,
          ))
      : [];
    frozen++;
  }
  return frozen > 0 ? { appearances, richClothing } : null;
}

export function archivedReplay(source: TotpBroadcastReplay): GigViewerReplay {
  const payload = source.payload, audienceReaction = lockedAudienceReaction(source);
  const baseCrowdEnergy = Math.max(28, Math.min(62, 44 + audienceReaction * 2));
  const performanceCrowdEnergy = Math.max(50, Math.min(92, 70 + audienceReaction * 3));
  const songStart = totpPerformanceStartMs(source), songEnd = songStart + payload.performanceDurationMs;
  let sequence = 0;
  const event = (partial: Record<string, unknown>): ReplayEvent => ({
    id: `${source.id}:${++sequence}`,
    gigId: `totp:${payload.performanceId}`,
    sequence,
    durationMs: 1_000,
    importance: "normal",
    messageKey: "totp.archive",
    messageParams: {},
    ...partial,
  } as unknown as ReplayEvent);
  const members = payload.band.members.length > 0 ? payload.band.members : [{ profile_id: `totp-placeholder:${payload.band.id}`, display_name: payload.band.name, role: "performer" }];
  const events: GigViewerReplay["events"] = [
    event({ phase: "venue_opening", eventType: "venue_opened", scheduledOffsetMs: 0, durationMs: 3_000, visualPayload: { type: "venue_open", entranceIds: ["studio"], lightLevel: .35 } }),
    event({ phase: "crowd_entry", eventType: "crowd_arrived", scheduledOffsetMs: 0, durationMs: 5_000, crowdEnergyBefore: Math.max(20, baseCrowdEnergy - 10), crowdEnergyAfter: baseCrowdEnergy, visualPayload: { type: "crowd_fill", targetDensity: .92, zoneIds: ["studio_floor"], enteringCount: 220 } }),
  ];
  members.forEach((member, index) => {
    const performerId = member.profile_id || `totp-member:${index}`;
    events.push(event({ phase: "band_entrance", eventType: "performer_entered", scheduledOffsetMs: 1_000 + index * 180, durationMs: 1_600, performerProfileId: performerId, visualPayload: { type: "performer_enter", performerId, displayName: member.display_name, roleOrInstrument: memberStageDuty(member, payload.band.members), startPosition: { x: 600, y: 520, zone: "back_center" } } }));
  });
  events.push(event({ phase: "song_intro", eventType: "song_started", scheduledOffsetMs: songStart, durationMs: payload.performanceDurationMs, songId: payload.song.id, crowdEnergyBefore: baseCrowdEnergy, crowdEnergyAfter: performanceCrowdEnergy, visualPayload: { type: "song_start", songId: payload.song.id, title: payload.song.title, position: 1, montage: false, itemType: "song" } }));
  events.push(event({ phase: "finale", eventType: "band_exited", scheduledOffsetMs: songEnd, durationMs: 4_000, visualPayload: { type: "band_exit", exitStyle: "wave", performerIds: members.map((member, index) => member.profile_id || `totp-member:${index}`) } }));
  return { id: source.id, gigId: `totp:${payload.performanceId}`, gigOutcomeId: `totp:${payload.performanceId}`, viewerVersion: 1, eventSchemaVersion: 1, simulationSeed: source.checksum, durationMs: payload.totalDurationMs, generatedAt: source.generated_at, events, checksum: source.checksum, status: "ready", resultAvailable: false } as GigViewerReplay;
}

export function archivedExperience(source: TotpBroadcastReplay): GigExperienceDTO {
  const payload = source.payload, audienceReaction = lockedAudienceReaction(source), crowdPeak = Math.max(50, Math.min(92, 70 + audienceReaction * 3));
  return {
    schemaVersion: 1,
    gig: { id: `totp:${payload.performanceId}`, bandId: payload.band.id, status: "completed", scheduledDate: payload.episodeDate, startedAt: payload.broadcastAt, completedAt: payload.broadcastAt, ticketPrice: metric(0), venue: { id: "totp-tv-studio", name: "RockMundo Television Centre", location: "London", capacity: 250, type: "tv_studio" } },
    headline: { overallRating: unavailable("Broadcast archive"), performanceGrade: unavailable("Broadcast archive"), verdict: `Archived Top of the Pops television performance · ${totpAudienceReactionLabel(audienceReaction)} studio audience`, attendance: metric(220), capacity: metric(250), netProfit: metric(0), fameGained: unavailable("Rewards are not replayed"), fansGained: unavailable("Rewards are not replayed"), bestSongTitle: metric(payload.song.title) },
    songs: [], performers: payload.band.members.map((member, index) => ({ id: member.profile_id || `totp-member:${index}`, profileId: member.profile_id || `totp-member:${index}`, displayName: member.display_name, roleOrInstrument: memberStageDuty(member, payload.band.members), lineupStatus: "performed" })),
    finances: { ticketRevenue: metric(0), merchRevenue: metric(0), totalRevenue: metric(0), crewCosts: metric(0), equipmentWearCost: metric(0), venueCost: metric(0), totalCosts: metric(0), netProfit: metric(0), merchItemsSold: metric(0) },
    progression: { fameGained: unavailable("Rewards are not replayed"), chemistryChange: unavailable("Broadcast archive"), totalXpAwarded: unavailable("Rewards are not replayed"), fansGained: unavailable("Rewards are not replayed"), fanConversions: unavailable("Rewards are not replayed") },
    analysis: { equipmentQuality: unavailable("Broadcast archive"), crewSkill: unavailable("Broadcast archive"), bandChemistry: unavailable("Broadcast archive"), memberSkills: unavailable("Broadcast archive"), crowdEnergyPeak: metric(crowdPeak), stageBehaviorUsed: unavailable("Broadcast archive"), gearEffects: null, warnings: [] },
    postConsequences: { processingStatus: "skipped", processingVersion: null, processedAt: null, liveReputationDelta: unavailable("Broadcast archive"), fanDelta: unavailable("Broadcast archive"), followerDelta: unavailable("Broadcast archive"), bookingDemandDelta: unavailable("Broadcast archive"), mediaCoverage: unavailable("Broadcast archive"), timeline: [], nextActions: [], consequences: [] },
    lessons: { worked: [], heldBack: [], recommendations: [] }, viewer: { ready: true, outcomeId: null, resultReadyAt: null, replayAvailable: true, replay: { viewerVersion: 1, durationMs: payload.totalDurationMs, generationStatus: "ready" } },
  } as GigExperienceDTO;
}

export function activeTotpCue(cues: TotpBroadcastCue[], positionMs: number): TotpBroadcastCue | null {
  const active = cues.filter((cue) => positionMs >= cue.offsetMs && positionMs < cue.offsetMs + cue.durationMs);
  return active.at(-1) ?? cues.filter((cue) => cue.offsetMs <= positionMs).at(-1) ?? cues[0] ?? null;
}

export interface TotpArchivePlayerProps { replay: TotpBroadcastReplay; autoPlay?: boolean; onEnded?: () => void; }

export function TotpArchivePlayer({ replay: source, autoPlay = false, onEnded }: TotpArchivePlayerProps) {
  const replay = useMemo(() => archivedReplay(source), [source]);
  const experience = useMemo(() => archivedExperience(source), [source]);
  const playerModelsSnapshot = useMemo(() => archivedPlayerModels(source), [source]);
  const audienceReaction = useMemo(() => lockedAudienceReaction(source), [source]);
  const presenterKey = useMemo(() => lockedPresenterKey(source), [source]);
  const showVariant = useMemo(() => lockedShowVariant(source), [source]);
  const presenter = resolveTotpPresenter(presenterKey), variantLabel = totpVariantLabel(showVariant);
  const [positionMs, setPositionMs] = useState(0), [playing, setPlaying] = useState(autoPlay);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const captions = useMemo(
    () => buildTotpCaptionCues(source.payload.cues, { presenterName: resolveTotpPresenter(lockedPresenterKey(source)).displayName }),
    [source],
  );
  const [resolvedBroadcastAudio, setResolvedBroadcastAudio] = useState<{ url: string | null; durationSeconds: number | null } | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioLoadFailed, setAudioLoadFailed] = useState(false);
  const [audioAttempt, setAudioAttempt] = useState(0);
  const endedRef = useRef(false);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const presenterAudioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const exportStopRef = useRef(false);
  const [exportState, setExportState] = useState<"idle" | "recording" | "finishing" | "error">("idle");
  const [exportPercent, setExportPercent] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [driveState, setDriveState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [exportLeadIn, setExportLeadIn] = useState(0);
  const [presenterSpeaking, setPresenterSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const spokenPresenterCueRef = useRef<string | null>(null);
  const playback = useMemo(() => derivePlaybackState(replay, positionMs, playing), [replay, positionMs, playing]);
  const cue = useMemo(() => activeTotpCue(source.payload.cues, positionMs), [source.payload.cues, positionMs]);

  useEffect(() => {
    setPositionMs(0);
    setPlaying(autoPlay);
    setAudioBlocked(false);
    endedRef.current = false;
    spokenPresenterCueRef.current = null;
  }, [source.id, autoPlay]);

  useEffect(() => {
    setResolvedBroadcastAudio(null);
    setAudioLoadFailed(false);
    if (source.payload.song.audioUrl || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(source.performance_id)) return;
    let cancelled = false;
    setAudioLoading(true);
    void getTotpPerformanceAudio(source.performance_id)
      .then((audio) => {
        if (cancelled) return;
        setResolvedBroadcastAudio({
          url: audio?.audio_url?.trim() || null,
          durationSeconds: audio?.duration_seconds ?? null,
        });
        setAudioLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedBroadcastAudio({ url: null, durationSeconds: null });
        setAudioLoadFailed(true);
        setAudioLoading(false);
      });
    return () => { cancelled = true; };
  }, [source.performance_id, source.payload.song.audioUrl, audioAttempt]);

  useEffect(() => {
    const url = source.payload.song.audioUrl?.trim() || resolvedBroadcastAudio?.url || "";
    songAudioRef.current?.pause();
    songAudioRef.current = null;
    if (!url) return;
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.volume = clampTotpGain(totpMixLevels("performance", audienceReaction).songBed);
    audio.onerror = () => setAudioLoadFailed(true);
    songAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (songAudioRef.current === audio) songAudioRef.current = null;
    };
  }, [resolvedBroadcastAudio?.url, source.id, source.payload.song.audioUrl, audienceReaction]);

  // Broadcast mix: duck the song bed under presenter links and audience reactions.
  useEffect(() => {
    const audio = songAudioRef.current;
    if (!audio) return;
    const bed = totpMixLevels(cue?.type, audienceReaction).songBed;
    // Extra duck while the presenter is actually talking, so the link is never buried.
    audio.volume = clampTotpGain(presenterSpeaking ? bed * 0.45 : bed);
  }, [cue?.type, audienceReaction, presenterSpeaking]);

  useEffect(() => {
    if (!playing) {
      songAudioRef.current?.pause();
      presenterAudioRef.current?.pause();
      return;
    }
    if (!audioEnabled || !songAudioRef.current) return;

    const songStartMs = totpPerformanceStartMs(source);
    const songEndMs = songStartMs + source.payload.performanceDurationMs;
    if (positionMs >= songEndMs) {
      songAudioRef.current.pause();
      return;
    }

    let timer = 0;
    const startSong = () => {
      const audio = songAudioRef.current;
      if (!audio || !audioEnabled) return;
      const target = Math.max(0, Math.min(
        source.payload.song.audioDurationSeconds ?? resolvedBroadcastAudio?.durationSeconds ?? Number.POSITIVE_INFINITY,
        (Math.max(songStartMs, positionMs) - songStartMs) / 1000,
      ));
      if (Number.isFinite(target) && Math.abs(audio.currentTime - target) > 1.5) audio.currentTime = target;
      void audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    };

    if (positionMs < songStartMs) timer = window.setTimeout(startSong, songStartMs - positionMs);
    else startSong();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [audioEnabled, playing, resolvedBroadcastAudio?.durationSeconds, source.id, source.payload.performanceDurationMs, source.payload.song.audioDurationSeconds]);

  useEffect(() => {
    if (!voiceEnabled) {
      setPresenterSpeaking(false);
      cancelTotpPresenterSpeech();
      return;
    }
    if (!playing || cue?.type !== "presenter" || !cue.presenterText || spokenPresenterCueRef.current === cue.id) return;
    spokenPresenterCueRef.current = cue.id;
    const holder: { current: TotpPresenterLineHandle | null } = { current: null };
    const line = playTotpPresenterLine({
      text: cue.presenterText,
      presenterKey,
      recordedUrl: totpMediaPublicUrl(TOTP_MEDIA_PATHS.presenter(presenterKey, "act-intro")),
      volume: clampTotpGain(totpMixLevels(cue.type, audienceReaction).presenter),
      onSpeakingChange: (speaking) => {
        setPresenterSpeaking(speaking);
        // Keep the export mixer pointed at the live presenter element.
        presenterAudioRef.current = speaking ? holder.current?.element ?? null : null;
      },
    });
    holder.current = line;


    return () => {
      line.stop();
      presenterAudioRef.current = null;
      setPresenterSpeaking(false);
    };
  }, [audienceReaction, cue?.id, cue?.presenterText, cue?.type, playing, presenterKey, voiceEnabled]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      const elapsed = now - previous; previous = now;
      setPositionMs((current) => {
        const next = Math.min(replay.durationMs, current + elapsed);
        if (next >= replay.durationMs) { setPlaying(false); exportStopRef.current = true; if (!endedRef.current) { endedRef.current = true; queueMicrotask(() => onEnded?.()); } }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, replay.durationMs, onEnded]);

  const restart = () => {
    endedRef.current = false;
    setPositionMs(0);
    setPlaying(false);
    setAudioBlocked(false);
    if (songAudioRef.current) songAudioRef.current.currentTime = 0;
  };
  const toggleAudio = () => {
    setAudioEnabled((enabled) => {
      const next = !enabled;
      if (!next) songAudioRef.current?.pause();
      setAudioBlocked(false);
      return next;
    });
  };
  const enableBlockedAudio = () => {
    setAudioEnabled(true);
    const audio = songAudioRef.current;
    if (!audio) return;
    const target = Math.max(0, (positionMs - totpPerformanceStartMs(source)) / 1000);
    audio.currentTime = target;
    void audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };
  const progress = Math.min(100, positionMs / Math.max(1, replay.durationMs) * 100);
  const startExport = async () => {
    const container = containerRef.current;
    if (!container || exportState === "recording" || exportState === "finishing") return;
    setExportError(null);
    setExportPercent(0);
    exportStopRef.current = false;
    restart();
    // Real on-air countdown so the recording starts on a clean cue.
    for (let remaining = totpCountdownSeconds(TOTP_EXPORT_LEAD_IN_MS); remaining > 0; remaining -= 1) {
      setExportLeadIn(remaining);
      await new Promise((resolve) => window.setTimeout(resolve, 1_000));
    }
    setExportLeadIn(0);
    try {
      const recording = recordTotpBroadcast({
        container,
        songAudio: songAudioRef.current,
        presenterAudio: presenterAudioRef.current,
        durationMs: replay.durationMs,
        shouldStop: () => exportStopRef.current,
        onProgress: (update) => {
          setExportState(update.state === "recording" ? "recording" : "finishing");
          setExportPercent(update.percent);
        },
      });
      setExportState("recording");
      setPlaying(true);
      const blob = await recording;
      setPlaying(false);
      const fileName = totpExportFileName(source.payload.episodeNumber, source.payload.episodeDate, blob);
      downloadTotpExport(blob, fileName);
      setLastExport({ blob, fileName });
      setDriveState("idle");
      setDriveLink(null);
      setDriveError(null);
      setExportState("idle");
    } catch (error) {
      setPlaying(false);
      setExportState("error");
      setExportError(error instanceof TotpExportUnsupportedError || error instanceof Error ? error.message : "The export failed — please try again.");
    }
  };
  const uploadToDrive = async () => {
    if (!lastExport || driveState === "uploading") return;
    setDriveState("uploading");
    setDriveError(null);
    try {
      const formData = new FormData();
      formData.append("fileName", lastExport.fileName);
      formData.append("file", new File([lastExport.blob], lastExport.fileName, { type: lastExport.blob.type || "video/webm" }));
      const { data, error } = await supabase.functions.invoke("totp-drive-upload", { body: formData });
      if (error) {
        const details = typeof error === "object" && error && "context" in error ? await (error as { context: Response }).context.text().catch(() => "") : "";
        throw new Error(details || error.message || "The upload failed.");
      }
      setDriveLink(typeof data?.webViewLink === "string" ? data.webViewLink : null);
      setDriveState("done");
    } catch (error) {
      setDriveState("error");
      setDriveError(error instanceof Error ? error.message : "The upload to Google Drive failed — please try again.");
    }
  };
  return <div ref={containerRef} className="space-y-3 rounded-xl border bg-card p-3" data-totp-archive-player data-visual-snapshot={playerModelsSnapshot ? "locked" : "legacy-fallback"}>
    <div className="relative mx-auto aspect-video min-h-[20rem] w-full max-w-5xl overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10">
      <TotpBroadcastRecoveryBoundary
        resetKey={`${source.id}:${cue?.id ?? "programme"}`}
        bandName={source.payload.band.name}
        songTitle={source.payload.song.title}
        chartRank={source.payload.song.qualifyingRank}
        presenterName={presenter.displayName}
        presenterText={cue?.type === "presenter" ? cue.presenterText : null}
      >
        <TotpBroadcastCanvas replay={replay} experience={experience} playbackState={playback} cue={cue} audienceReaction={audienceReaction} presenterKey={presenterKey} showVariant={showVariant} playerModelsSnapshot={playerModelsSnapshot} captions={captions} showCaptions={captionsEnabled} className="h-full w-full" />
      </TotpBroadcastRecoveryBoundary>
      {audioLoading ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 text-center text-sm font-semibold text-white" data-totp-audio-loading>
          <span className="animate-pulse tracking-[0.18em]">PREPARING BROADCAST AUDIO…</span>
        </div>
      ) : null}
      {audioLoadFailed && !audioLoading ? (
        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-red-900/85 px-4 py-2 text-xs font-semibold text-white" data-totp-audio-recovery>
          <span>The recording for this act could not be loaded. The performance still plays without it.</span>
          <Button size="sm" variant="secondary" onClick={() => { setAudioLoadFailed(false); setAudioAttempt((value) => value + 1); }}>Try audio again</Button>
        </div>
      ) : null}
      {exportLeadIn > 0 ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 text-white" data-totp-export-countdown>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200">Recording in</span>
          <span key={exportLeadIn} className="mt-3 animate-in zoom-in-75 fade-in text-6xl font-black tabular-nums duration-200">{exportLeadIn}</span>
        </div>
      ) : null}
    </div>
    <div className="space-y-2"><Progress value={progress} className="h-1.5" /><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{playing ? "Pause" : "Play"}</Button><Button size="sm" variant="outline" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" /> Restart</Button><Button size="sm" variant="outline" onClick={() => setCaptionsEnabled((value) => !value)} aria-pressed={captionsEnabled} data-totp-captions-toggle>{captionsEnabled ? <Captions className="mr-2 h-4 w-4" /> : <CaptionsOff className="mr-2 h-4 w-4" />}{captionsEnabled ? "Subtitles on" : "Subtitles off"}</Button><Button size="sm" variant={presenterSpeaking ? "default" : "outline"} onClick={() => setVoiceEnabled((value) => !value)} aria-pressed={voiceEnabled} data-totp-voice-toggle><Mic className={`mr-2 h-4 w-4 ${presenterSpeaking ? "animate-pulse" : ""}`} />{voiceEnabled ? (presenterSpeaking ? "Presenter on air" : "Presenter voice on") : "Presenter voice off"}</Button><Button size="sm" variant="outline" onClick={() => void startExport()} disabled={exportState === "recording" || exportState === "finishing" || exportLeadIn > 0} data-totp-export>{exportState === "recording" || exportState === "finishing" ? <Video className="mr-2 h-4 w-4 animate-pulse" /> : <Download className="mr-2 h-4 w-4" />}{exportState === "recording" ? `Recording… ${exportPercent}%` : exportState === "finishing" ? "Finishing…" : exportLeadIn > 0 ? `Recording in ${exportLeadIn}…` : "Export broadcast master"}</Button>{lastExport ? <Button size="sm" variant="outline" onClick={() => void uploadToDrive()} disabled={driveState === "uploading"} data-totp-drive-upload><CloudUpload className="mr-2 h-4 w-4" />{driveState === "uploading" ? "Saving to Drive…" : driveState === "done" ? "Saved to Drive" : "Save to Google Drive"}</Button> : null}{(source.payload.song.audioUrl || resolvedBroadcastAudio?.url) ? <Button size="sm" variant={audioBlocked ? "default" : "outline"} onClick={audioBlocked ? enableBlockedAudio : toggleAudio}>{audioEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}{audioBlocked ? "Enable song audio" : audioEnabled ? "Song audio on" : "Song audio off"}</Button> : <span className="self-center text-xs text-muted-foreground">No recording attached to this song</span>}</div><div className="text-xs text-muted-foreground">{presenter.displayName}{variantLabel ? ` · ${variantLabel}` : ""} · {totpAudienceReactionLabel(audienceReaction)} audience · {playerModelsSnapshot ? "historical outfits locked" : "legacy outfit fallback"} · checksum {source.checksum.slice(0, 8)} · replay v{source.replay_version}</div></div></div>
    {exportState === "error" && exportError ? <p className="text-xs font-medium text-destructive" data-totp-export-error>{exportError}</p> : null}
    {exportState === "recording" ? <p className="text-xs text-muted-foreground" data-totp-export-profile>Recording a broadcast master ({TOTP_EXPORT_PROFILE.label}). Exporting plays the episode through once at normal speed — leave this tab open until the download starts.</p> : null}{driveState === "done" ? <p className="text-xs text-muted-foreground" data-totp-drive-done>Saved to your Google Drive.{driveLink ? <> <a className="underline" href={driveLink} target="_blank" rel="noreferrer">Open in Drive</a></> : null}</p> : null}{driveState === "error" && driveError ? <p className="text-xs font-medium text-destructive" data-totp-drive-error>{driveError}</p> : null}
  </div>;
}

export default TotpArchivePlayer;