import { useEffect, useMemo, useRef, useState } from "react";
import type { GigExperienceDTO } from "../../types";
import type { StorySnapshot } from "../engine/StoryEngine";
import type { PlaybackSpeed } from "../engine/PlaybackController";
import { GigAudioController } from "./GigAudioController";
import { loadGigAudioPreferences, saveGigAudioPreferences } from "./audioPreferences";
import { resolveGigSongAudio } from "./audioSourceResolver";

const AUDIO_RESYNC_THRESHOLD_SECONDS = 4;
const TRANSITION_APPLAUSE_DURATION_SECONDS = 3.2;

export function useGigViewerAudio({ experience, snapshot, replaySeed, isPlaying, speed, open, excerptDurationSeconds }: { experience?: GigExperienceDTO | null; snapshot: StorySnapshot | null; replaySeed: string; isPlaying: boolean; speed: PlaybackSpeed; open: boolean; excerptDurationSeconds?: number }) {
  const controller = useRef<GigAudioController | null>(null);
  if (!controller.current) controller.current = new GigAudioController();

  const [prefs, setPrefs] = useState(loadGigAudioPreferences);
  const [activated, setActivated] = useState(false);
  const [, rerender] = useState(0);
  const lastSongIdRef = useRef<string | null>(null);
  const applaudedSongIdRef = useRef<string | null>(null);

  const songId = snapshot?.song?.id ?? null;
  const songDto = useMemo(
    () => experience?.songs.find((s) => (s.performanceItemId ?? s.songId ?? s.id) === songId) ?? null,
    [experience, songId],
  );

  // Audio selection must stay stable while elapsedMs advances. Previously the
  // whole changing song snapshot was a dependency, which made normal replay
  // ticks repeatedly re-evaluate and re-sync the active HTMLAudioElement.
  const source = useMemo(
    () => resolveGigSongAudio(songDto, snapshot?.song, replaySeed, { excerptDurationSeconds }),
    // The resolver only needs stable segment identity/timing metadata here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [songDto, songId, snapshot?.song?.startMs, snapshot?.song?.endMs, snapshot?.song?.title, replaySeed, excerptDurationSeconds],
  );
  const silentForSpeed = speed !== 1;

  useEffect(() => {
    saveGigAudioPreferences(prefs);
    controller.current?.setVolume(prefs.volume, prefs.muted);
  }, [prefs]);

  useEffect(() => {
    if (!silentForSpeed) controller.current?.setPlaybackRate(speed);
  }, [speed, silentForSpeed]);

  useEffect(() => {
    const song = snapshot?.song;
    if (silentForSpeed || !open || !song || snapshot?.resultVisible || !source.available) {
      controller.current?.stop();
      lastSongIdRef.current = null;
      applaudedSongIdRef.current = null;
      rerender((value) => value + 1);
      return;
    }

    const currentSongId = song.id;
    const changedSong = lastSongIdRef.current !== currentSongId;
    if (changedSong) {
      lastSongIdRef.current = currentSongId;
      applaudedSongIdRef.current = null;
    }

    controller.current?.load(source, prefs.volume, prefs.muted, speed);

    const elapsedSeconds = Math.max(0, song.elapsedMs / 1000);
    const targetTime = source.excerptStartSeconds + Math.min(elapsedSeconds, source.excerptDurationSeconds);
    const drift = Math.abs((controller.current?.currentTime() ?? targetTime) - targetTime);

    // Hard-sync when a new song starts or after a real seek/jump. Normal replay
    // drift is allowed to free-run so the song does not stutter every few ticks.
    if (changedSong || drift > AUDIO_RESYNC_THRESHOLD_SECONDS) {
      controller.current?.seek(targetTime);
    }

    const musicWindowActive = elapsedSeconds < source.excerptDurationSeconds;
    const shouldPlayMusic = activated && prefs.enabled && isPlaying && musicWindowActive;

    if (shouldPlayMusic) {
      if (controller.current?.status !== "playing") {
        controller.current?.play().catch(() => rerender((value) => value + 1));
      }
    } else {
      controller.current?.pause();
    }

    // The player timeline deliberately leaves a short gap after each music
    // excerpt. Fill that gap with a one-shot applause/cheer before the next song.
    if (
      !musicWindowActive
      && activated
      && prefs.enabled
      && isPlaying
      && !prefs.muted
      && applaudedSongIdRef.current !== currentSongId
    ) {
      applaudedSongIdRef.current = currentSongId;
      playTransitionApplause(prefs.volume);
    }
  }, [
    open,
    source,
    songId,
    snapshot?.song?.elapsedMs,
    snapshot?.resultVisible,
    isPlaying,
    activated,
    prefs.enabled,
    prefs.muted,
    prefs.volume,
    speed,
    silentForSpeed,
  ]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") controller.current?.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      controller.current?.stop();
    };
  }, []);

  return {
    source,
    status: controller.current.status,
    error: controller.current.error,
    enabled: prefs.enabled,
    muted: prefs.muted,
    volume: prefs.volume,
    ambience: prefs.ambience,
    setAmbience: (ambience: boolean) => setPrefs((p) => ({ ...p, ambience })),
    silentForSpeed,
    enable: async () => {
      setActivated(true);
      setPrefs((p) => ({ ...p, enabled: true, muted: false }));
      controller.current?.setVolume(prefs.volume, false);
      if (!silentForSpeed && source.available) await controller.current?.play().catch(() => {});
      rerender((value) => value + 1);
    },
    disable: () => {
      setPrefs((p) => ({ ...p, enabled: false }));
      controller.current?.pause();
    },
    setMuted: (muted: boolean) => setPrefs((p) => ({ ...p, muted })),
    setVolume: (volume: number) => setPrefs((p) => ({ ...p, volume })),
  };
}

function playTransitionApplause(volume: number) {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const ctx = new AudioContextCtor();
  const duration = TRANSITION_APPLAUSE_DURATION_SECONDS;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const progress = index / length;
    const roar = (Math.random() * 2 - 1) * (0.28 + (1 - progress) * 0.12);
    const clapProbability = 0.035 + (1 - progress) * 0.055;
    const clap = Math.random() < clapProbability ? (Math.random() * 2 - 1) * 0.95 : 0;
    data[index] = (roar + clap) * (1 - progress * 0.35);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 260;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 4200;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const peak = Math.max(0.08, Math.min(0.65, volume * 0.58));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.05);
  gain.gain.setValueAtTime(peak, now + Math.min(1.2, duration * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(ctx.destination);
  source.onended = () => {
    void ctx.close().catch(() => undefined);
  };

  void ctx.resume().catch(() => undefined).finally(() => {
    try {
      source.start();
      source.stop(ctx.currentTime + duration + 0.05);
    } catch {
      void ctx.close().catch(() => undefined);
    }
  });
}
