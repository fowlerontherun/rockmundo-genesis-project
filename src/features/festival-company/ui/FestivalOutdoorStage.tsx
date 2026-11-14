import { useEffect, useRef, useState } from "react";
import { ConcertScene } from "@/features/gig-demo-3d/ConcertScene";
import type { CameraShot } from "@/features/gig-demo-3d/config";
import { festivalStagePreset } from "@/features/gig-demo-3d/festivalStagePreset";
import { CrowdAudioManager } from "@/features/shared-audio/CrowdAudioManager";
import { loadCuratedCrowdAssets, selectCuratedCrowdClip } from "@/features/shared-audio/crowdAudioCatalogue";

const cameras = [
  { id: "front", label: "Stage wide" },
  { id: "side_pit", label: "Side stage" },
  { id: "crane", label: "Crowd overview" },
] as const;

export default function FestivalOutdoorStage(props: Parameters<typeof festivalStagePreset>[0]) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ConcertScene | null>(null);
  const audio = useRef<CrowdAudioManager | null>(null);
  const [camera, setCamera] = useState<CameraShot>("front");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [sound, setSound] = useState<"off" | "loading" | "playing" | "unavailable" | "error">("off");
  const preset = festivalStagePreset(props);
  const latest = useRef(preset);
  latest.current = preset;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const { stageId, editionId, capacity, stageName, artist } = props;
  const daylight = preset.options.outdoorDaylight;

  useEffect(() => {
    if (!canvas.current) return;
    let active = true;
    setStatus("loading");
    try {
      const { options, settings } = latest.current;
      scene.current = new ConcertScene(canvas.current, { ...settings, camera: cameraRef.current }, () => {}, (next) => {
        if (active) setStatus(next);
      }, options);
    } catch {
      setStatus("error");
    }
    return () => {
      active = false;
      scene.current?.destroy();
      scene.current = null;
    };
  }, [stageId, editionId, capacity, stageName, artist, daylight, attempt]);

  useEffect(() => {
    scene.current?.setSettings({ ...latest.current.settings, camera });
  }, [camera, props.reducedMotion, preset.settings.crowd, artist, daylight, attempt]);

  function stopSound() {
    audio.current?.dispose();
    audio.current = null;
    setSound("off");
  }

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) stopSound(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);

  useEffect(() => { stopSound(); }, [editionId, stageId, capacity, props.crowdBand, status]);

  async function playSound() {
    if (!latest.current.crowdCue || audio.current) return;
    const engine = new CrowdAudioManager();
    audio.current = engine;
    setSound("loading");
    try {
      engine.prime();
      engine.setCrowdVolume(.5);
      const assets = (await loadCuratedCrowdAssets()).filter((asset) => asset.loopable);
      if (audio.current !== engine || !latest.current.crowdCue) return;
      const request = latest.current.crowdCue;
      const clip = selectCuratedCrowdClip(assets, request) ??
        selectCuratedCrowdClip(assets, { ...request, environment: "outdoor" });
      const playing = clip ? await engine.setAmbience(clip) : false;
      if (audio.current !== engine) return;
      if (playing) { setSound("playing"); return; }
      engine.dispose();
      audio.current = null;
      setSound(clip ? "error" : "unavailable");
    } catch {
      if (audio.current !== engine) return;
      engine.dispose();
      audio.current = null;
      setSound("error");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="relative aspect-video min-h-36 overflow-hidden rounded-lg bg-slate-950">
        <canvas className="block h-full w-full" ref={canvas} role="img" aria-label={`Illustrative 3D view of ${stageName}`} />
        {status !== "ready" && (
          <div className="absolute inset-0 grid place-content-center gap-2 bg-slate-950 px-3 text-center text-sm text-white"
            role={status === "error" ? "alert" : "status"}>
            {status === "loading" ? "Loading outdoor stage…" : <>
              <p>3D stage unavailable. The stage guide is still available.</p>
              <button type="button" className="min-h-11 rounded border px-3" onClick={() => setAttempt((value) => value + 1)}>Retry 3D stage</button>
            </>}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Stage and crowd illustration based on the selected stage. Official activity is listed above.</p>
      {status === "ready" && <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">Camera
          <select className="min-h-11 rounded border bg-background px-2" value={camera}
            onChange={(event) => setCamera(event.target.value as CameraShot)}>
            {cameras.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        {preset.crowdCue && (
          <button type="button" className="min-h-11 rounded border px-3 text-sm"
            onClick={sound === "playing" || sound === "loading" ? stopSound : () => void playSound()}>
            {sound === "playing" || sound === "loading" ? "Stop crowd audio" : "Play crowd audio"}
          </button>
        )}
      </div>}
      {sound !== "off" && <p role="status" className="text-xs text-muted-foreground">
        {{ loading: "Loading crowd audio…", playing: "Crowd ambience playing.", unavailable: "No approved ambience is available for this stage crowd.", error: "Crowd audio could not play. Try again." }[sound]}
      </p>}
    </div>
  );
}
