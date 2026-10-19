import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConcertScene } from "@/features/gig-demo-3d/ConcertScene";
import { DEFAULT_SETTINGS, type CameraShot, type DemoSettings } from "@/features/gig-demo-3d/config";
import { useGigPlayerModels } from "@/features/player-model/usePlayerModel";
import {
  buildDjClubStageOptions, buildDjClubStageFrame, djStageOccupancy,
  type DjStageAudience, type DjStageBooking, type DjStageMixEvent,
} from "./djClubStageModel";

/**
 * Optional presentation-only 3D booth for the booking's actual selected DJ.
 * All reads use current-character RLS. Never fabricate gig results or send
 * mixer events/rewards from rendering or camera controls.
 */
export function DjLiveClubStage({
  bookingId, profileId, clubId, clubName, capacity,
}: {
  bookingId: string;
  profileId: string;
  clubId: string;
  clubName: string;
  capacity?: number | null;
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
        .select("id,status,starts_at,ends_at").eq("id", bookingId)
        .eq("profile_id", profileId).single();
      if (error) throw error;
      return data as DjStageBooking;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const mixer = useQuery<DjStageMixEvent[]>({
    queryKey: ["dj-stage-mix-evidence", profileId, bookingId],
    enabled: booking.data?.status === "live",
    queryFn: async () => {
      // Exactly the accepted, server-timed owner-only evidence; no browser taps.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_live_mix_events")
        .select("event_no,kind,recorded_at").eq("booking_id", bookingId)
        .eq("profile_id", profileId).order("event_no", { ascending: false }).limit(24);
      if (error) throw error;
      return (data ?? []) as DjStageMixEvent[];
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
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
  const options = useMemo(
    () => buildDjClubStageOptions(profileId, clubId, clubName, capacity, models.data),
    [profileId, clubId, clubName, capacity, models.data],
  );
  const frame = useMemo(() => booking.data
    ? buildDjClubStageFrame(
        booking.data, profileId, mixer.data ?? [], audience.data ?? null, capacity,
        nowMs, reducedMotion, options.performers[0].position,
      )
    : null, [booking.data, profileId, mixer.data, audience.data, capacity, nowMs, reducedMotion, options],
  );

  const settings: DemoSettings = {
    ...DEFAULT_SETTINGS, playing: true, camera, crowd: frame?.crowd ?? 0,
    energy: frame?.energy ?? 0.25, reducedMotion,
    quality: lowGraphics ? "low" : "balanced",
    haze: false, // no strobe or mandatory fog in this safety-first viewer
  };

  useEffect(() => {
    if (booking.data?.status !== "live" || !canvasRef.current || models.isLoading) return;
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
  }, [booking.data?.status, models.isLoading, options, retry]);

  useEffect(() => {
    if (!rendererRef.current || booking.data?.status !== "live") return;
    rendererRef.current.setSettings(settings);
    rendererRef.current.setEffects(false, 0);
    if (frame) rendererRef.current.setFrame(frame);
  });

  const occupancy = djStageOccupancy(audience.data ?? null, capacity);

  if (booking.isLoading) return <p role="status" className="text-sm text-muted-foreground">Checking live DJ booking…</p>;
  if (booking.isError || !booking.data) {
    return <p role="alert" className="text-sm text-destructive">Cannot verify this DJ booking. Stage viewing is unavailable.</p>;
  }
  if (booking.data.status !== "live") {
    return <p role="status" className="text-sm text-muted-foreground">This DJ set is {booking.data.status}. Live stage viewing has ended.</p>;
  }

  return (
    <section aria-label="Live DJ nightclub 3D booth" className="space-y-2" data-testid="dj-live-3d-stage">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <strong className="flex items-center gap-2"><Camera className="h-4 w-4" /> Live nightclub stage</strong>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="button" variant="outline" onClick={() => setCamera(camera === "front" ? "lead_close" : "front")}>
            {camera === "front" ? "DJ close-up" : "Wide view"}
          </Button>
          <Button size="sm" type="button" variant="outline" aria-pressed={lowGraphics} onClick={() => setLowGraphics(x => !x)}>
            {lowGraphics ? "Standard graphics" : "Low graphics"}
          </Button>
          <Button size="sm" type="button" variant="outline" aria-pressed={reducedMotion} onClick={() => setReducedMotion(x => !x)}>
            {reducedMotion ? "Enable motion" : "Reduce motion"}
          </Button>
        </div>
      </div>
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
      </p>
      {mixer.isError && <p role="alert" className="text-xs text-destructive">Live mixer evidence could not be refreshed; crowd reactions may be out of date.</p>}
      {models.isError && <p role="status" className="text-xs text-muted-foreground">Avatar cosmetics could not be loaded. A basic DJ model is shown.</p>}
    </section>
  );
}
