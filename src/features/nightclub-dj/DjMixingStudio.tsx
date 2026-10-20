import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Disc3, Headphones, Music, Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterDjTracks, getDjPlaybackUrl, type DjAudioTrack, useDjTrackLibrary } from "./library";
import { clampDeckRate, deckAudioSourceKey, changedDjTempoPercent, djCueSkipBeats, equalPowerCrossfade, estimatedDjBeatAt, formatDjTime, syncDeckRate } from "./mixerMath";
import { DjSetlistPlanner } from "./DjSetlistPlanner";
import { djReadinessSteps, useDjMixReadiness } from "./djReadiness";
import { bindDjDeckLifecycle } from "./deckAudioLifecycle";
import { deliverDjMixEvent } from "./mixerEventDelivery";
import { DjPadBank, DjPlatter, DjTrimMeter, DjWaveform } from "./DjHardwareVisuals";
import { djHotCueSeek, djJogSeek, emptyDjHotCues, storeDjHotCue, type DjHotCueSlots } from "./djHardwareControls";
import "./DjConsole.css";

function AudioDeck({
  deck, tracks, selectedId, onSelect, level, trim, rate, onRateChange, onDeckPlay, onRateCommit,
}: {
  deck: "A" | "B"; tracks: DjAudioTrack[];
  selectedId: string; onSelect: (id: string) => void;
  level: number; trim: number; rate: number; onRateChange: (rate: number) => void;
  onDeckPlay?: (deck: "A" | "B", track: DjAudioTrack) => void;
  onRateCommit?: (deck: "A" | "B", speed: number) => void;
}) {
  const track = tracks.find((entry) => entry.id === selectedId) ?? null;
  const audioSourceKey = deckAudioSourceKey(track);
  // The effect depends on the source signature, not every catalogue metadata refresh.
  const playableTrackRef = useRef(track);
  playableTrackRef.current = track;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cue, setCue] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [hotCues, setHotCues] = useState<DjHotCueSlots>(emptyDjHotCues);
  const [padMode, setPadMode] = useState<"store" | "play">("play");
  // Per-track scratch-pad positions are local; never write fake mixer events.
  useEffect(() => {
    setHotCues(emptyDjHotCues());
    setPadMode("play");
  }, [audioSourceKey]);

  const pressHotCue = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    if (padMode === "store") {
      setHotCues(previous => storeDjHotCue(previous, index, audio.currentTime, duration));
      return;
    }
    const next = djHotCueSeek(hotCues, index, duration);
    if (next !== null) { audio.currentTime = next; setElapsed(next); }
  };
  const nudgeJog = (direction: -1 | 1) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = djJogSeek(audio.currentTime, direction, duration);
    if (next !== null) { audio.currentTime = next; setElapsed(next); }
  };
  const beat = estimatedDjBeatAt(elapsed, track?.bpm ?? null, rate);
  const canJumpBar = Boolean(beat && duration > 0);
  const jumpBar = (direction: -1 | 1) => {
    const player = audioRef.current;
    if (!player) return;
    const next = djCueSkipBeats(player.currentTime, track?.bpm ?? null, 4 * direction, duration);
    if (next === null) return;
    player.currentTime = next;
    setElapsed(next);
  };

  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;
    return bindDjDeckLifecycle(player, document, window);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const player = audioRef.current;
    if (!player) return;
    player.pause();
    player.removeAttribute("src");
    player.load();
    setPlaying(false);
    setElapsed(0);
    setDuration(0);
    setCue(0);
    setError(null);
    setLoading(false);
    const playableTrack = playableTrackRef.current;
    if (!playableTrack) return;
    setLoading(true);
    getDjPlaybackUrl(playableTrack).then((url) => {
      if (cancelled) return;
      player.src = url;
      player.load();
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Audio unavailable");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      player.pause();
      player.removeAttribute("src");
      player.load();
    };
  // Restart for a new/withdrawn media source or explicit retry, NOT an
  // unchanged source returned as a fresh object on a catalogue refresh.
  }, [audioSourceKey, retryNonce]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, level * trim / 100));
    audioRef.current.playbackRate = clampDeckRate(rate);
  }, [level, trim, rate, selectedId]);

  const togglePlayback = async () => {
    const player = audioRef.current;
    if (!player || loading || !player.src) return;
    if (!player.paused) { player.pause(); return; }
    try {
      await player.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Playback was blocked");
    }
  };

  return (
    <Card className={`rm-dj-deck rm-dj-deck--${deck.toLowerCase()}`}>
      <CardHeader className="rm-dj-deck-head">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><span className="rm-dj-deck-tag">{deck}</span><span className="rm-dj-small-label">ROCKMUNDO / DIRECT DRIVE</span></span>
          <Badge variant="secondary">{track?.source === "admin" ? "Club library" : "RockMundo"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="rm-dj-deck-content">
        <Select value={selectedId || undefined} onValueChange={onSelect}>
          <SelectTrigger aria-label={`Choose a track for deck ${deck}`}>
            <SelectValue placeholder="Load a track..." />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {tracks.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.title} · {item.artist}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rm-dj-deck-display">
          <div className="rm-dj-track-row">
            <div className="min-w-0">
              <p className="rm-dj-track-name">{track?.title ?? "Load a track"}</p>
              <p className="rm-dj-track-artist">{track?.artist ?? "RockMundo"}</p>
            </div>
            <div className="rm-dj-track-bpm">{beat?.audibleBpm ?? track?.bpm ?? "—"}<small>BPM</small></div>
          </div>
          <DjWaveform deck={deck} trackId={audioSourceKey} position={duration > 0 ? elapsed / duration : 0} />
          <div className="rm-dj-display-times"><span>{formatDjTime(elapsed)} / {formatDjTime(duration)}</span><span>{track?.musicalKey ?? "KEY —"}</span></div>
          <p className="rm-dj-visual-note">Illustrative waveform · seek with the track-position slider below</p>
        </div>
        <audio
          ref={audioRef}
          preload="metadata"
          onPlay={() => {
            setPlaying(true);
            if (track) onDeckPlay?.(deck, track);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onError={(event) => {
            // Media can fail while loading metadata. Ignore src-less cleanup
            // events, but never hide a real failed URL behind the loading flag.
            if (track && event.currentTarget.getAttribute("src")) {
              event.currentTarget.pause();
              setPlaying(false);
              setLoading(false);
              setError("Could not load this audio file");
            }
          }}
        />
        <div className="rm-dj-control-box space-y-1">
          <Slider aria-label={`Deck ${deck} seek position`} value={[Math.min(elapsed, duration || 1)]}
            min={0} max={Math.max(1, Math.ceil(duration))} step={1} disabled={!duration}
            onValueChange={([value]) => { if (audioRef.current && duration) audioRef.current.currentTime = value; }} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDjTime(elapsed)}</span><span>{formatDjTime(duration)}</span>
          </div>
        </div>
        <div className="rm-dj-deck-workbench">
          <DjPlatter deck={deck} playing={playing} disabled={!duration} onNudge={nudgeJog} />
          <DjPadBank deck={deck} cues={hotCues} mode={padMode} disabled={!duration}
            onPress={pressHotCue} onToggleMode={() => setPadMode(value => value === "store" ? "play" : "store")} />
        </div>
        <div className="rm-dj-control-box space-y-1" data-testid={`dj-beat-guide-${deck}`}>
          {beat ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>Estimated beat {beat.barBeat} / 4 · {beat.audibleBpm} BPM audible</span>
                <span className="text-muted-foreground">Metadata estimate, not beat detection</span>
              </div>
              <div className="grid grid-cols-4 gap-1" aria-label={`Estimated four-beat bar on deck ${deck}`}>
                {[1, 2, 3, 4].map(number => (
                  <div key={number} className={`h-2 rounded-full ${number === beat.barBeat ? "bg-primary" : "bg-muted"}`}
                    aria-hidden="true" />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Beat guide unavailable: no reliable BPM metadata.</p>
          )}
        </div>
        <div className="rm-dj-transport">
          <Button type="button" className="rm-dj-play" onClick={togglePlayback} disabled={!track || loading || !!error}>
            {playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button type="button" variant="outline" disabled={!track || !duration}
            onClick={() => setCue(audioRef.current?.currentTime ?? 0)}>
            <Headphones className="h-4 w-4 mr-1" /> Set cue
          </Button>
          <Button type="button" variant="outline" disabled={!track || !duration}
            onClick={() => { if (audioRef.current) audioRef.current.currentTime = cue; }}>
            <RotateCcw className="h-4 w-4 mr-1" /> Cue {formatDjTime(cue)}
          </Button>
          <Button type="button" variant="outline" disabled={!canJumpBar}
            aria-label={`Jump deck ${deck} back four estimated beats`} onClick={() => jumpBar(-1)}>
            -4 beats
          </Button>
          <Button type="button" variant="outline" disabled={!canJumpBar}
            aria-label={`Jump deck ${deck} forward four estimated beats`} onClick={() => jumpBar(1)}>
            +4 beats
          </Button>
        </div>
        <div className="rm-dj-control-box space-y-2">
          <div className="flex justify-between text-xs">
            <span>Tempo (playback speed)</span><span>{(rate * 100).toFixed(0)}%</span>
          </div>
          <Slider aria-label={`Deck ${deck} playback speed`} min={85} max={115} step={1}
            value={[Math.round(rate * 100)]}
            onValueChange={([value]) => onRateChange(clampDeckRate(value / 100))}
            onValueCommit={([value]) => onRateCommit?.(deck, value)} />
        </div>
        {error && (
          <div className="flex flex-wrap items-center gap-2" role="alert">
            <p className="text-xs text-destructive">{error}</p>
            <Button type="button" size="sm" variant="outline" disabled={!track || loading}
              onClick={() => setRetryNonce((value) => value + 1)}>
              <RotateCcw className="mr-1 h-3 w-3" /> Retry audio
            </Button>
          </div>
        )}
        {loading && <p className="text-xs text-muted-foreground">Preparing playable audio...</p>}
      </CardContent>
    </Card>
  );
}

/** Practice is reward-free. Booked sessions require server-recorded interactions. */
export function DjMixingStudio({ liveBookingId, clubName }: { liveBookingId?: string; clubName?: string }) {
  const { profileId } = useActiveProfile();
  const client = useQueryClient();
  const { data: libraryTracks = [], isLoading, isError, error } = useDjTrackLibrary(profileId);
  const { data: liveBooking, isLoading: liveLoading, isError: liveError } = useQuery({
    queryKey: ["dj-live-booking", profileId, liveBookingId],
    enabled: Boolean(liveBookingId && profileId),
    // The club/owner may close a session from another device. Stop the live
    // decks promptly rather than relying on the original status forever.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_bookings")
        .select("id,status,setlist_snapshot").eq("id", liveBookingId)
        .eq("profile_id", profileId).single();
      if (error) throw error;
      return data as { id: string; status: string;
        setlist_snapshot: Array<{ source: "game" | "admin"; id: string }> };
    },
  });
  const tracks = useMemo(() => {
    if (!liveBookingId) return libraryTracks;
    if (!liveBooking || liveBooking.status !== "live") return [];
    const allowed = new Set((liveBooking.setlist_snapshot || [])
      .map((item) => item.source + ":" + item.id));
    return libraryTracks.filter((track) => allowed.has(track.source + ":" + track.sourceId));
  }, [libraryTracks, liveBookingId, liveBooking]);
  const { data: readiness, isError: readinessError } =
    useDjMixReadiness(liveBookingId, profileId);
  const [pendingEvents, setPendingEvents] = useState(0);
  const lastAttempt = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const activeBooking = useRef<string | undefined>(liveBookingId);
  activeBooking.current = liveBookingId;
  // A remote close or failed status refresh revokes queued UI permission
  // immediately. The backend still performs the final authorization check.
  const liveBookingActive = useRef(false);
  liveBookingActive.current = !liveError && liveBooking?.status === "live";
  const mounted = useRef(true);

  // Drop actions still queued behind the spacing/backoff timer when the
  // mixing screen closes. A request already sent may be accepted server-side
  // but can never create a *new* event after this component is abandoned.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeBooking.current = undefined;
    };
  }, []);

  // A single event UUID is generated per actual player action. Retries only
  // repeat that UUID, never mint new performance evidence or rewards.
  const sendLiveEvent = (event: Record<string, unknown>) => {
    if (!liveBookingId || !mounted.current || !liveBookingActive.current) return;
    const bookingId = liveBookingId;
    const eventId = crypto.randomUUID();
    setPendingEvents((count) => count + 1);
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        if (!mounted.current || activeBooking.current !== bookingId || !liveBookingActive.current) return;
        const remaining = 2200 - (Date.now() - lastAttempt.current);
        if (remaining > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remaining));
        }
        await deliverDjMixEvent({
          isActive: () => mounted.current && activeBooking.current === bookingId && liveBookingActive.current,
          invoke: async () => {
            lastAttempt.current = Date.now();
            return supabase.functions.invoke("dj-booking-action", {
              body: { action: "mix_event", bookingId, eventId, ...event },
            });
          },
          onAcknowledged: () => client.invalidateQueries({
            queryKey: ["dj-live-readiness", profileId, bookingId],
          }),
          delay: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
        });
      } catch (error) {
        if (mounted.current && activeBooking.current === bookingId && liveBookingActive.current) {
          toast.error(error instanceof Error ? error.message : "Mixer interaction could not be recorded");
        }
      } finally {
        if (mounted.current) setPendingEvents((count) => Math.max(0, count - 1));
      }
    });
  };
  const [deckA, setDeckA] = useState("");
  const [deckB, setDeckB] = useState("");
  const [rateA, setRateA] = useState(1);
  const [rateB, setRateB] = useState(1);
  const [trimA, setTrimA] = useState(100);
  const [trimB, setTrimB] = useState(100);
  const [crossfade, setCrossfade] = useState(0);
  const [sharing, setSharing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "game" | "admin">("all");
  const matches = useMemo(() => filterDjTracks(tracks, search, sourceFilter), [tracks, sourceFilter, search]);
  const levels = useMemo(() => equalPowerCrossfade(crossfade), [crossfade]);

  useEffect(() => {
    if (!tracks.length) return;
    if (!tracks.some((track) => track.id === deckA)) setDeckA(tracks[0].id);
    if (!tracks.some((track) => track.id === deckB)) setDeckB(tracks[1]?.id ?? tracks[0].id);
  }, [tracks, deckA, deckB]);

  const syncB = () => {
    const a = tracks.find((item) => item.id === deckA);
    const b = tracks.find((item) => item.id === deckB);
    const target = a?.bpm ? a.bpm * rateA : null;
    const rate = syncDeckRate(b?.bpm ?? null, target);
    if (rate === null) { toast.info("BPM metadata is missing or the tempo difference is too large. Adjust by ear."); return; }
    const changedPercent = changedDjTempoPercent(rateB, rate);
    setRateB(rate);
    // A one-tap BPM match is a real tempo adjustment, just like the manual
    // slider. Do not claim evidence when nothing changed or in practice.
    if (changedPercent !== null) {
      sendLiveEvent({ kind: "tempo", deck: "B", value: changedPercent });
    }
    toast.success("Deck B tempo matched. Fine-tune the beat phase by ear.");
  };

  const toggleSharing = async (track: DjAudioTrack, enabled: boolean) => {
    if (!profileId || !track.mine) return;
    setSharing(track.id);
    try {
      const { data, error } = await (supabase as any).from("songs").update({ dj_use_allowed: enabled })
        .eq("id", track.sourceId).eq("profile_id", profileId)
        .select("id").single();
      if (error || !data) throw error || new Error("Song permission could not be updated");
      await client.invalidateQueries({ queryKey: ["dj-track-library", profileId] });
      toast.success(enabled ? "Sharing enabled. Other DJs can now play this recording." : "DJ sharing disabled.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to update DJ sharing"); }
    finally { setSharing(null); }
  };

  if (isLoading || (liveBookingId && liveLoading)) return <p className="text-sm text-muted-foreground">Loading playable DJ tracks...</p>;
  if (liveBookingId && liveError) return (
    <p className="text-sm text-destructive" role="alert">
      Could not verify your live DJ session. Reconnect or reopen the club before mixing.
      New mixer activity cannot be verified until your session reconnects.
    </p>
  );
  if (liveBookingId && (!liveBooking || liveBooking.status !== "live")) return (
    <p className="text-sm text-destructive" role="alert">
      This DJ booking is {liveBooking?.status ?? "unavailable"}. Only a live booked set can record mixer activity. Return to your bookings for its current result.
    </p>
  );
  if (isError) return <p className="text-sm text-destructive" role="alert">Unable to load DJ tracks: {error instanceof Error ? error.message : "Unknown error"}. The catalogue migration may still need deploying.</p>;
  if (liveBookingId && !tracks.length) return (
    <p className="text-sm text-destructive" role="alert">
      None of the songs in this booked DJ set are currently playable. Audio access or music rights
      may have changed since booking. Reopen the club or contact an administrator;
      practice tracks cannot substitute for the locked setlist or produce new verified mixer evidence.
    </p>
  );
  if (!tracks.length) return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        No playable tracks yet. Record a song with audio or ask an admin to publish a cleared club track.
        You can still review or delete previously saved DJ sets below.
      </p>
      <DjSetlistPlanner key={profileId ?? "none"} profileId={profileId} tracks={[]}
        onRehearse={(first, second) => { setDeckA(first); setDeckB(second); }}
        onLoadTrack={(id, deck) => { if (deck === "A") setDeckA(id); else setDeckB(id); }} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="dj-mixing-studio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {liveBookingId
            ? "Live booked performance: only songs in the booked set are playable. Use both decks, adjust tempo and crossfade during the set. The server checks timestamps and interactions before settlement."
            : "Practice with real RockMundo audio. Start each deck separately and crossfade between them."}
        </p>
        <Badge variant="outline">
          {liveBookingId
            ? `Scheduled live set · ${readiness?.count ?? 0} confirmed${pendingEvents ? ` · ${pendingEvents} syncing` : ""}`
            : "Practice · No rewards"}
        </Badge>
      </div>
      {liveBookingId && (
        <div className="rounded-md border p-3 text-sm space-y-2" aria-live="polite">
          <p className="font-semibold">Server-verified set readiness</p>
          {readinessError && (
            <p className="text-xs text-destructive" role="alert">
              Unable to load the live DJ checklist. Completion remains server-controlled.
            </p>
          )}
          {!readiness && !readinessError && (
            <p className="text-xs text-muted-foreground">Checking your live performance…</p>
          )}
          {readiness && (
            <>
              <ul className="space-y-1 text-xs">
                {djReadinessSteps(readiness).map((step) => (
                  <li key={step.id}>
                    <span className={step.complete ? "text-green-500" : "text-muted-foreground"}>
                      {step.complete ? "✓" : "○"} {step.label}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs font-medium">
                {readiness.can_settle
                  ? "Ready — return to your booked set and finish to receive results."
                  : readiness.evidence_ready
                    ? "Mixer activity complete. Finish after your scheduled set ends."
                    : "Keep mixing until each requirement is checked. Practice mode never grants rewards."}
              </p>
            </>
          )}
        </div>
      )}
      <section className="rm-dj-console" aria-label="RockMundo interactive DJ controller"
        data-testid="rm-dj-hardware-console">
        <header className="rm-dj-console-head">
          <div className="min-w-0">
            <div className="rm-dj-console-kicker">ROCKMUNDO / DJ EXPERIENCE</div>
            <h3 className="rm-dj-console-title">{clubName ? `${clubName} · DJ BOOTH` : "THE DJ BOOTH"}</h3>
            <p className="rm-dj-console-sub">
              Two real audio decks, eight local hot cues per deck and a two-channel output mixer.
              Play from the cleared RockMundo track library.
            </p>
          </div>
          <span className="rm-dj-console-status" data-live={liveBookingId ? "true" : "false"}>
            {liveBookingId ? `LIVE SET · ${readiness?.count ?? 0} verified` : "PRACTICE · NO REWARDS"}
          </span>
        </header>
        <div className="rm-dj-console-grid">
          <AudioDeck deck="A" tracks={tracks} selectedId={deckA} onSelect={setDeckA}
            level={levels.a} trim={trimA} rate={rateA} onRateChange={setRateA}
            onDeckPlay={(deck, track) => { sendLiveEvent({ kind: "deck_play", deck, source: track.source, trackId: track.sourceId }); }}
            onRateCommit={(deck, value) => { sendLiveEvent({ kind: "tempo", deck, value }); }} />
          <Card className="rm-dj-mixer">
            <CardHeader className="rm-dj-deck-head">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <SlidersHorizontal className="h-4 w-4 text-violet-300" /> RM2 / MIXER
              </CardTitle>
              <p className="rm-dj-small-label">TWO-CHANNEL OUTPUT</p>
            </CardHeader>
            <CardContent className="rm-dj-mixer-body">
              <div className="rm-dj-mixer-channel-grid">
                {([
                  { side: "A" as const, trim: trimA, onTrim: setTrimA, output: levels.a },
                  { side: "B" as const, trim: trimB, onTrim: setTrimB, output: levels.b },
                ]).map(channel => (
                  <div key={channel.side} className={`rm-dj-mixer-channel rm-dj-mixer-channel--${channel.side.toLowerCase()}`}>
                    <h4>CH {channel.side}</h4>
                    <div className="rm-dj-eq-fascia" aria-hidden="true">
                      {["HI", "MID", "LOW"].map(label => (
                        <span key={label}><i className="rm-dj-knob" />{label}</span>
                      ))}
                    </div>
                    <div className="rm-dj-fader-with-meter">
                      <div className="rm-dj-mixer-fader">
                        <label htmlFor={`rm-dj-trim-${channel.side}`}>TRIM {channel.trim}%</label>
                        <input id={`rm-dj-trim-${channel.side}`} type="range"
                          aria-label={`Deck ${channel.side} output trim`}
                          min={0} max={100} step={1} value={channel.trim}
                          onChange={event => channel.onTrim(Number(event.target.value))} />
                      </div>
                      <DjTrimMeter side={channel.side} active={channel.trim > 0}
                        value={channel.output * channel.trim / 100} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rm-dj-crossfade space-y-3">
                <div className="rm-dj-crossfade-scale"><span>A</span><span>CROSSFADE</span><span>B</span></div>
                <Slider aria-label="DJ crossfader from deck A to B" value={[crossfade]}
                  min={0} max={100} step={1}
                  onValueChange={([value]) => setCrossfade(value)}
                  onValueCommit={([value]) => { sendLiveEvent({ kind: "crossfade", value }); }} />
                <p className="text-center text-xs text-slate-300">
                  A {100 - crossfade}% / B {crossfade}%
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={syncB}
                className="text-xs">SYNC B → A</Button>
              <p className="rm-dj-mixer-caption">
                Channel trim and crossfader change real deck volume. EQ knobs are
                a visual preview and are not active yet; LED strips indicate trim position,
                not measured audio signal.
              </p>
            </CardContent>
          </Card>
          <AudioDeck deck="B" tracks={tracks} selectedId={deckB} onSelect={setDeckB}
            level={levels.b} trim={trimB} rate={rateB} onRateChange={setRateB}
            onDeckPlay={(deck, track) => { sendLiveEvent({ kind: "deck_play", deck, source: track.source, trackId: track.sourceId }); }}
            onRateCommit={(deck, value) => { sendLiveEvent({ kind: "tempo", deck, value }); }} />
        </div>
        <footer className="rm-dj-console-foot">
          <span>HOT CUE PADS: tap SET PADS to store · tap numbered pads to jump</span>
          <span>Estimated BPM guidance · no fabricated audio waveforms or crowd scores</span>
        </footer>
      </section>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Music className="h-4 w-4" /> Track Library ({tracks.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="search" aria-label="Search DJ tracks" placeholder="Search song, artist, genre, BPM or key..."
            value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter DJ track source">
            {(["all", "game", "admin"] as const).map((source) => (
              <Button key={source} type="button" size="sm" variant={sourceFilter === source ? "default" : "outline"}
                aria-pressed={sourceFilter === source} onClick={() => setSourceFilter(source)}>
                {source === "all" ? "All tracks" : source === "game" ? "RockMundo songs" : "Club library"}
              </Button>
            ))}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5" aria-live="polite">
            {matches.length === 0 && <p className="text-sm text-muted-foreground py-3">No matching playable tracks.</p>}
            {matches.slice(0, 40).map((track) => (
              <div key={track.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.genre} · {track.bpm ? `${track.bpm} BPM` : "BPM unknown"}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => setDeckA(track.id)}
                    aria-label={`Load ${track.title} by ${track.artist} to deck A`}>Load A</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDeckB(track.id)}
                    aria-label={`Load ${track.title} by ${track.artist} to deck B`}>Load B</Button>
                </div>
              </div>
            ))}
          </div>
          {matches.length > 40 && <p className="text-xs text-muted-foreground">Showing the first 40 matches. Refine your search to find more.</p>}
        </CardContent>
      </Card>
      {!liveBookingId ? (
        <DjSetlistPlanner key={profileId ?? "none"} profileId={profileId} tracks={tracks}
          onRehearse={(first, second) => { setDeckA(first); setDeckB(second); }}
          onLoadTrack={(id, deck) => { if (deck === "A") setDeckA(id); else setDeckB(id); }} />
      ) : (
        <p className="text-xs text-muted-foreground" role="status">
          This performance uses the setlist snapshot locked when you booked it. Setlist edits
          are available in practice mode and do not modify the active show.
        </p>
      )}
      {!liveBookingId && tracks.some((track) => track.mine) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Music className="h-4 w-4" /> Share my tracks with other DJs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Only recorded or released songs you explicitly allow are listed for other players. Your own songs remain available in your deck either way.</p>
            {tracks.filter((track) => track.mine).map((track) => (
              <div key={track.id} className="flex items-center justify-between gap-3">
                <span className="text-sm truncate">{track.title}</span>
                <Switch aria-label={`Allow other DJs to use ${track.title}`} checked={track.sharedForDj} disabled={sharing === track.id}
                  onCheckedChange={(checked) => toggleSharing(track, checked)} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
