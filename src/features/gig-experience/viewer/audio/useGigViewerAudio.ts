import { useEffect, useMemo, useRef, useState } from "react";
import type { GigExperienceDTO } from "../../types";
import type { StorySnapshot } from "../engine/StoryEngine";
import type { PlaybackSpeed } from "../engine/PlaybackController";
import { GigAudioController } from "./GigAudioController";
import { loadGigAudioPreferences, saveGigAudioPreferences } from "./audioPreferences";
import { resolveGigSongAudio } from "./audioSourceResolver";

export function useGigViewerAudio({ experience, snapshot, replaySeed, isPlaying, speed, open }: { experience?: GigExperienceDTO | null; snapshot: StorySnapshot | null; replaySeed: string; isPlaying: boolean; speed: PlaybackSpeed; open: boolean }) {
  const controller = useRef<GigAudioController | null>(null); if (!controller.current) controller.current = new GigAudioController();
  const [prefs, setPrefs] = useState(loadGigAudioPreferences); const [activated, setActivated] = useState(false); const [, rerender] = useState(0);
  const songDto = useMemo(() => experience?.songs.find((s) => (s.songId ?? s.id) === snapshot?.song?.id) ?? null, [experience, snapshot?.song?.id]);
  const source = useMemo(() => resolveGigSongAudio(songDto, snapshot?.song, replaySeed), [songDto, snapshot?.song, replaySeed]);
  const silentForSpeed = speed !== 1;
  useEffect(() => { saveGigAudioPreferences(prefs); controller.current?.setVolume(prefs.volume, prefs.muted || silentForSpeed); }, [prefs, silentForSpeed]);
  useEffect(() => {
    if (!open || !snapshot?.song || snapshot.resultVisible || !source.available || silentForSpeed) { controller.current?.stop(); rerender((v)=>v+1); return; }
    controller.current?.load(source, prefs.volume, prefs.muted); const targetTime = source.excerptStartSeconds + snapshot.song.elapsedMs / 1000; if (Math.abs((controller.current?.currentTime() ?? 0) - targetTime) > 1.5) controller.current?.seek(targetTime);
    if (activated && prefs.enabled && isPlaying) controller.current?.play().catch(() => rerender((v)=>v+1)); else controller.current?.pause();
    rerender((v)=>v+1);
  }, [open, source.songId, source.url, source.excerptStartSeconds, snapshot?.song?.elapsedMs, snapshot?.resultVisible, isPlaying, activated, prefs.enabled, prefs.muted, prefs.volume, silentForSpeed]);
  useEffect(() => { const onVis = () => { if (document.visibilityState === "hidden") controller.current?.pause(); }; document.addEventListener("visibilitychange", onVis); return () => { document.removeEventListener("visibilitychange", onVis); controller.current?.stop(); }; }, []);
  return { source, status: controller.current.status, error: controller.current.error, enabled: prefs.enabled, muted: prefs.muted || silentForSpeed, volume: prefs.volume, silentForSpeed, enable: async () => { setActivated(true); setPrefs((p) => ({ ...p, enabled: true })); if (source.available && !silentForSpeed) await controller.current?.play().catch(()=>{}); rerender((v)=>v+1); }, disable: () => { setPrefs((p) => ({ ...p, enabled: false })); controller.current?.pause(); }, setMuted: (muted: boolean) => setPrefs((p) => ({ ...p, muted })), setVolume: (volume: number) => setPrefs((p) => ({ ...p, volume })) };
}
