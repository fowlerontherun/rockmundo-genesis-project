import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConcertScene } from "@/features/gig-demo-3d/ConcertScene";
import { DEFAULT_SETTINGS, type CameraShot, type DemoSettings } from "@/features/gig-demo-3d/config";
import { useGigPlayerModels } from "@/features/player-model/usePlayerModel";
import { djStageEvidencePageSize, djStageEvidenceQueryKey } from "./djStageEvidenceQuery";
import {
  buildDjClubStageOptions, buildDjClubStageFrame, djStageOccupancy,
  djReplayDurationMs, djReplayEventsThrough, hasVerifiedDjReplay, djMixerActivityLabel,
  type DjStageAudience, type DjStageBooking, type DjStageMixEvent,
} from "./djClubStageModel";

/**
 * Optional presentation-only 3D booth for the booking's actual selected DJ.
 * All reads use current-character RLS. Never fabricate gig results or send
 * mixer events/rewards from rendering or camera controls.
 */
export function DjLiveClubStage({
  bookingId, profileId, clubId, clubName, capacity, mode = "live",
}: {
  bookingId: string;
  profileId: string;
  clubId: string;
  clubName: string;
  capacity?: number | null;
  mode?: "live" | "replay";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ConcertScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [camera, setCamera] = useState<CameraShot>("front");
  const [lowGraphics, setLowGraphics] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [replayMs, setReplayMs] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timer = window.setInterval(tick, 2000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const booking = useQuery<DjStageBooking>({
    queryKey: ["dj-stage-booking", profileId, bookingId],
    queryFn: async () => {
      // Canonical DJ schema is newer than the generated client types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_bookings")
        .select("id,club_id,status,starts_at,ends_at").eq("id", bookingId)
        .eq("profile_id", profileId).single();
      if (error) throw error;
      return data as DjStageBooking;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const mixer = useQuery<DjStageMixEvent[]>({
    queryKey: djStageEvidenceQueryKey(profileId, bookingId, mode),
    enabled: booking.data?.club_id === clubId &&
      (mode === "replay" ? booking.data?.status === "completed" : booking.data?.status === "live"),
    queryFn: async () => {
      // Exactly the accepted, server-timed owner-only evidence; no browser taps.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_live_mix_events")
        .select("event_no,kind,deck,recorded_at").eq("booking_id", bookingId)
        .eq("profile_id", profileId)
        .order("event_no", { ascending: mode === "replay" }).limit(djStageEvidencePageSize(mode));
      if (error) throw error;
      return (data ?? []) as DjStageMixEvent[];
    },
    // Completed bookings cannot accept more actions. Keep the full replay
    // sequence stable; poll only the live viewer.
    refetchInterval: mode === "live" ? 5000 : false,
    refetchOnWindowFocus: mode === "live",
  });

  const audience = useQuery<DjStageAudience | null>({
    queryKey: ["dj-stage-verified-audience", profileId, bookingId],
    queryFn: async () => {
      // Receipts exist only AFTER authoritative settlement; never make one up.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_booking_audiences")
        .select("attendance,venue_capacity").eq("booking_id", bookingId)
        .eq("profile_id", profileId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as DjStageAudience | null;
    },
    refetchInterval: 30000,
  });

  const models = useGigPlayerModels([profileId]);
  const durationMs = booking.data ? djReplayDurationMs(booking.data) : 0;
  const isReplay = mode === "replay";
  const isAuthorizedStage = !booking.isError && booking.data?.club_id === clubId &&
    (isReplay ? hasVerifiedDjReplay(booking.data, clubId, audience.data, mixer.data,
      mixer.isError || audience.isError)
      : booking.data?.status === "live");

  useEffect(() => {
    if (!isReplay || !isAuthorizedStage || !replayPlaying) return;
    const timer = window.setInterval(() => {
      setReplayMs(previous => Math.min(durationMs, previous + 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isReplay, isAuthorizedStage, replayPlaying, durationMs]);

  useEffect(() => {
    if (replayPlaying && replayMs >= durationMs) setReplayPlaying(false);
  }, [replayPlaying, replayMs, durationMs]);

  const options = useMemo(
    () => ({
      ...buildDjClubStageOptions(
        profileId, clubId, clubName, capacity ?? audience.data?.venue_capacity, models.data,
      ),
      // A historical replay is driven exclusively by seek position, not rAF time.
      externalClock: isReplay,
    }),
    [profileId, clubId, clubName, capacity, audience.data?.venue_capacity, models.data, isReplay],
  );
  const viewedAtMs = isReplay
    ? Date.parse(booking.data?.starts_at ?? "") + replayMs
    : nowMs;
  const visibleEvents = isReplay
    ? djReplayEventsThrough(mixer.data ?? [], viewedAtMs)
    : mixer.data ?? [];
  const frame = useMemo(() => booking.data && isAuthorizedStage
    ? buildDjClubStageFrame(
        booking.data, profileId, visibleEvents, audience.data ?? null, capacity,
        viewedAtMs, reducedMotion, options.performers[0].position, isReplay,
      )
    : null, [booking.data, isAuthorizedStage, profileId, visibleEvents, audience.data,
      capacity, viewedAtMs, reducedMotion, options, isReplay]);

  const settings: DemoSettings = {
    ...DEFAULT_SETTINGS, playing: !isReplay || replayPlaying, camera, crowd: frame?.crowd ?? 0,
    energy: frame?.energy ?? 0.25, reducedMotion,
    quality: lowGraphics ? "low" : "balanced",
    haze: false, // no strobe or mandatory fog in this safety-first viewer
  };

  useEffect(() => {
    if (!isAuthorizedStage || !canvasRef.current || models.isLoading) return;
    let alive = true;
    setStatus("loading"); setError("");
    try {
      const scene = new ConcertScene(canvasRef.current, settings, () => undefined,
        (state, reason) => { if (alive) { setStatus(state); setError(reason ?? ""); } }, options);
      rendererRef.current = scene;
      scene.setEffects(false, 0);
      if (frame) scene.setFrame(frame);
    } catch {
      setStatus("error");
      setError("3D graphics could not start on this device. Use the live mixer below.");
    }
    return () => { alive = false; rendererRef.current?.destroy(); rendererRef.current = null; };
    // Only rebuild the GPU scene on appearance/venue changes or explicit retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorizedStage, models.isLoading, options, retry]);

  useEffect(() => {
    if (!rendererRef.current || !isAuthorizedStage) return;
    rendererRef.current.setSettings(settings);
    rendererRef.current.setEffects(false, 0);
    if (frame) rendererRef.current.setFrame(frame);
  });

  const occupancy = djStageOccupancy(audience.data ?? null, capacity);
  const recentEvidence = visibleEvents
    .filter(event => Number.isInteger(event.event_no) && event.event_no > 0 &&
      Number.isFinite(Date.parse(event.recorded_at)) &&
      Date.parse(event.recorded_at) <= viewedAtMs)
    .sort((a, b) => a.event_no - b.event_no)
    .slice(-10);

  if (booking.isLoading) return <p role="status" className="text-sm text-muted-foreground">Checking live DJ booking…</p>;
  if (booking.isError || !booking.data) {
    return <p role="alert" className="text-sm text-destructive">Cannot verify this DJ booking. Stage viewing is unavailable.</p>;
  }
  if (booking.data.club_id !== clubId) {
    return <p role="alert" className="text-sm text-destructive">The club does not match the verified DJ booking.</p>;
  }
  if (isReplay ? booking.data.status !== "completed" : booking.data.status !== "live") {
    return <p role="status" className="text-sm text-muted-foreground">This set is {booking.data.status}; {isReplay ? "only completed sets have replays." : "live stage viewing has ended."}</p>;
  }
  if (isReplay && (audience.isLoading || mixer.isLoading)) {
    return <p role="status" className="text-sm text-muted-foreground">Verifying completed performance and saved mixer events…</p>;
  }
  if (isReplay && (audience.isError || mixer.isError || !audience.data || !mixer.data || durationMs <= 0)) {
    return <p role="alert" className="text-sm text-destructive">Verified replay data is incomplete or unavailable. No performance has been simulated.</p>;
  }

  return (
    <section aria-label={isReplay ? "Completed DJ set replay" : "Live DJ nightclub 3D booth"} className="space-y-2" data-testid={isReplay ? "dj-completed-replay" : "dj-live-3d-stage"}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <strong className="flex items-center gap-2"><Camera className="h-4 w-4" /> {isReplay ? "Verified DJ set replay" : "Live nightclub stage"}</strong>
        <div className="flex flex-wrap gap-2">
          {([
            ["front", "Wide"],
            ["dj_booth", "DJ booth"],
            ["dj_overhead", "Overhead"],
            ["dj_dancefloor", "Dancefloor"],
            ["dj_reverse", "Behind decks"],
          ] as const satisfies readonly (readonly [CameraShot, string])[]).map(([shot, label]) => (
            <Button key={shot} size="sm" type="button" variant="outline"
              aria-label={`Show ${label.toLowerCase()} camera`}
              aria-pressed={camera === shot} onClick={() => setCamera(shot)}>
              {label}
            </Button>
          ))}
          <Button size="sm" type="button" variant="outline" aria-pressed={lowGraphics} onClick={() => setLowGraphics(x => !x)}>
            {lowGraphics ? "Standard graphics" : "Low graphics"}
          </Button>
          <Button size="sm" type="button" variant="outline" aria-pressed={reducedMotion} onClick={() => setReducedMotion(x => !x)}>
            {reducedMotion ? "Enable motion" : "Reduce motion"}
          </Button>
        </div>
      </div>
      {isReplay && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <Button type="button" size="sm" variant="outline"
            onClick={() => {
              if (replayMs >= durationMs) setReplayMs(0);
              setReplayPlaying(value => !value || replayMs >= durationMs);
            }}>
            {replayPlaying ? "Pause replay" : replayMs >= durationMs ? "Replay again" : "Play replay"}
          </Button>
          <label htmlFor="dj-replay-position" className="text-xs">Replay position</label>
          <input id="dj-replay-position" type="range" min={0} max={durationMs} step={1000}
            value={Math.min(replayMs, durationMs)} className="min-w-32 flex-1"
            onChange={event => setReplayMs(Number(event.target.value))}
            aria-valuetext={new Date(Math.min(replayMs, durationMs)).toISOString().slice(11, 19)} />
          <span className="text-xs tabular-nums" aria-live="off">
            {new Date(Math.min(replayMs, durationMs)).toISOString().slice(11, 19)} /
            {" "}{new Date(durationMs).toISOString().slice(11, 19)}
          </span>
        </div>
      )}
      <div className="relative aspect-video min-h-48 overflow-hidden rounded-lg bg-slate-950">
        <canvas ref={canvasRef} className="h-full w-full" role="img"
          aria-label={`Read-only 3D DJ booth at ${clubName}. Solo DJ at the turntables, illustrated crowd and club lighting.`} />
        {(status !== "ready" || models.isLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/95 p-5 text-center text-slate-100"
            role={status === "error" ? "alert" : "status"}>
            <p>{status === "error" ? error : "Loading your DJ avatar and nightclub stage…"}</p>
            {status === "error" && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setRetry(x => x + 1)}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Retry 3D view
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {audience.isError
          ? "Verified attendance is unavailable; the dancefloor is an illustration, not an attendance figure."
          : occupancy.verified
            ? `Verified attendance receipt: ${audience.data?.attendance} of ${Math.min(capacity || Infinity, audience.data?.venue_capacity || Infinity)} capacity.`
            : "The dancing crowd is illustrative until the server settles attendance; it does not represent ticket sales or DJ followers."}
        {" "}Animations react only to accepted mixer actions. The 3D viewer never awards cash, XP, fame or fans.
        {isReplay && " This is a silent visual reconstruction from stored events, not recorded video or song playback. Outfits reflect your current avatar."}
      </p>
      <details className="rounded-md border p-3 text-sm" data-testid="dj-verified-mixer-timeline">
        <summary className="cursor-pointer font-medium">
          Verified mixer activity {mixer.data ? `(${visibleEvents.length} actions visible)` : ""}
        </summary>
        {mixer.isError
          ? <p role="alert" className="mt-2 text-xs text-destructive">
              Verified action history is unavailable. No actions have been simulated.
            </p>
          : recentEvidence.length === 0
            ? <p className="mt-2 text-xs text-muted-foreground">
                No server-confirmed mixer actions at this point in the set.
              </p>
            : (
              <ol className="mt-2 space-y-1" aria-label="Server-confirmed DJ actions">
                {recentEvidence.map(event => (
                  <li key={event.event_no} className="flex flex-wrap items-center justify-between gap-2 border-b py-1 last:border-0">
                    <span>{djMixerActivityLabel(event)}</span>
                    <time className="text-xs text-muted-foreground" dateTime={event.recorded_at}>
                      {new Date(event.recorded_at).toLocaleTimeString()}
                    </time>
                  </li>
                ))}
              </ol>
            )}
        <p className="mt-2 text-xs text-muted-foreground">
          Read-only event evidence. This timeline is available even when 3D graphics are unavailable.
        </p>
      </details>
      {mixer.isError && <p role="alert" className="text-xs text-destructive">Live mixer evidence could not be refreshed; crowd reactions may be out of date.</p>}
      {models.isError && <p role="status" className="text-xs text-muted-foreground">Avatar cosmetics could not be loaded. A basic DJ model is shown.</p>}
    </section>
  );
}
