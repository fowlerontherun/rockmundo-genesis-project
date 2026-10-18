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
import { clampDeckRate, deckAudioSourceKey, changedDjTempoPercent, equalPowerCrossfade, formatDjTime, syncDeckRate } from "./mixerMath";
import { DjSetlistPlanner } from "./DjSetlistPlanner";
import { djReadinessSteps, useDjMixReadiness } from "./djReadiness";
import { bindDjDeckLifecycle } from "./deckAudioLifecycle";

function AudioDeck({
  deck, tracks, selectedId, onSelect, level, rate, onRateChange, onDeckPlay, onRateCommit,
}: {
  deck: "A" | "B"; tracks: DjAudioTrack[];
  selectedId: string; onSelect: (id: string) => void;
  level: number; rate: number; onRateChange: (rate: number) => void;
  onDeckPlay?: (deck: "A" | "B", track: DjAudioTrack) => void;
  onRateCommit?: (deck: "A" | "B", speed: number) => void;
}) {
  const track = tracks.find((entry) => entry.id === selectedId) ?? null;
  const audioSourceKey = deckAudioSourceKey(track);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cue, setCue] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

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
    if (!track) return;
    setLoading(true);
    getDjPlaybackUrl(track).then((url) => {
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
    audioRef.current.volume = Math.max(0, Math.min(1, level));
    audioRef.current.playbackRate = clampDeckRate(rate);
  }, [level, rate, selectedId]);

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Disc3 className="h-4 w-4 text-primary" /> Deck {deck}</span>
          <Badge variant="secondary">{track?.source === "admin" ? "Club library" : "RockMundo"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <div className="text-sm min-h-10">
          <p className="font-medium truncate">{track?.title ?? "Select a track"}</p>
          <p className="text-xs text-muted-foreground">{track?.genre ?? "—"} · {track?.bpm ? `${track.bpm} BPM` : "BPM unknown"} · {track?.musicalKey ?? "Key unknown"}</p>
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
        <div className="space-y-1">
          <Slider aria-label={`Deck ${deck} seek position`} value={[Math.min(elapsed, duration || 1)]}
            min={0} max={Math.max(1, Math.ceil(duration))} step={1} disabled={!duration}
            onValueChange={([value]) => { if (audioRef.current && duration) audioRef.current.currentTime = value; }} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDjTime(elapsed)}</span><span>{formatDjTime(duration)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={togglePlayback} disabled={!track || loading || !!error}>
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
        </div>
        <div className="space-y-2">
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
export function DjMixingStudio({ liveBookingId }: { liveBookingId?: string }) {
  const { profileId } = useActiveProfile();
  const client = useQueryClient();
  const { data: libraryTracks = [], isLoading, isError, error } = useDjTrackLibrary(profileId);
  const { data: liveBooking, isLoading: liveLoading } = useQuery({
    queryKey: ["dj-live-booking", profileId, liveBookingId],
    enabled: Boolean(liveBookingId && profileId),
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
  const activeBooking = useRef(liveBookingId);
  activeBooking.current = liveBookingId;

  // Queue sends in user-action order, while preserving the same idempotency
  // key across network retries. No browser-supplied timestamp is trusted.
  const sendLiveEvent = (event: Record<string, unknown>) => {
    if (!liveBookingId) return;
    const bookingId = liveBookingId;
    const eventId = crypto.randomUUID();
    setPendingEvents((count) => count + 1);
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        if (activeBooking.current !== bookingId) return;
        const remaining = 2200 - (Date.now() - lastAttempt.current);
        if (remaining > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remaining));
        }
        if (activeBooking.current !== bookingId) return;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          lastAttempt.current = Date.now();
          try {
            const { data, error } = await supabase.functions.invoke("dj-booking-action", {
              body: { action: "mix_event", bookingId, eventId, ...event },
            });
            if (error) {
              const context = (error as { context?: Response }).context;
              const status = context?.status ?? 0;
              if (status >= 400 && status < 500) {
                let message = error.message;
                try {
                  const payload = await context?.clone().json() as { error?: string } | undefined;
                  message = payload?.error || message;
                } catch { /* Preserve SDK validation message. */ }
                throw new Error(message);
              }
              if (attempt < 2) {
                await new Promise<void>((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                continue;
              }
              throw error;
            }
            if (data?.error || typeof data?.id !== "string") {
              throw new Error(data?.error || "DJ mixer event was not acknowledged");
            }
            await client.invalidateQueries({ queryKey: ["dj-live-readiness", profileId, bookingId] });
            return;
          } catch (error) {
            if (attempt >= 2 || !(error instanceof Error) ||
                !/network|fetch|timeout/i.test(error.message)) {
              throw error;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Mixer interaction could not be recorded");
      } finally {
        setPendingEvents((count) => Math.max(0, count - 1));
      }
    });
  };
  const [deckA, setDeckA] = useState("");
  const [deckB, setDeckB] = useState("");
  const [rateA, setRateA] = useState(1);
  const [rateB, setRateB] = useState(1);
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
  if (liveBookingId && (!liveBooking || liveBooking.status !== "live")) return (
    <p className="text-sm text-destructive" role="alert">
      Live DJ session unavailable. Start the booked set before mixing for credit.
    </p>
  );
  if (isError) return <p className="text-sm text-destructive" role="alert">Unable to load DJ tracks: {error instanceof Error ? error.message : "Unknown error"}. The catalogue migration may still need deploying.</p>;
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
      <DjSetlistPlanner key={profileId ?? "none"} profileId={profileId} tracks={tracks}
        onRehearse={(first, second) => { setDeckA(first); setDeckB(second); }}
        onLoadTrack={(id, deck) => { if (deck === "A") setDeckA(id); else setDeckB(id); }} />
      <div className="grid gap-4 md:grid-cols-2">
        <AudioDeck deck="A" tracks={tracks} selectedId={deckA} onSelect={setDeckA} level={levels.a}
          rate={rateA} onRateChange={setRateA}
          onDeckPlay={(deck, track) => { void sendLiveEvent({ kind: "deck_play", deck, source: track.source, trackId: track.sourceId }); }}
          onRateCommit={(deck, value) => { void sendLiveEvent({ kind: "tempo", deck, value }); }} />
        <AudioDeck deck="B" tracks={tracks} selectedId={deckB} onSelect={setDeckB} level={levels.b}
          rate={rateB} onRateChange={setRateB}
          onDeckPlay={(deck, track) => { void sendLiveEvent({ kind: "deck_play", deck, source: track.source, trackId: track.sourceId }); }}
          onRateCommit={(deck, value) => { void sendLiveEvent({ kind: "tempo", deck, value }); }} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4" /> Mixer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm"><span>Crossfader</span><span>A {100 - crossfade}% / B {crossfade}%</span></div>
          <Slider aria-label="DJ crossfader from deck A to B" value={[crossfade]} min={0} max={100} step={1}
            onValueChange={([value]) => setCrossfade(value)}
            onValueCommit={([value]) => { void sendLiveEvent({ kind: "crossfade", value }); }} />
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Deck A</span><span>Deck B</span></div>
          <Button type="button" variant="secondary" onClick={syncB}>Match Deck B tempo to A</Button>
          <p className="text-xs text-muted-foreground">Tempo adjustment changes playback speed and pitch. True key-locked beatmatching and timed drops will follow in the DJ minigame.</p>
        </CardContent>
      </Card>
      {tracks.some((track) => track.mine) && (
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
