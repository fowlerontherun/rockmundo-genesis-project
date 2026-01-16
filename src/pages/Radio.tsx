import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  Clock,
  Music,
  PlayCircle,
  Radio as RadioIcon,
  XCircle,
  TrendingUp,
  Users,
  BarChart3,
  Calendar,
  Signal,
  Award,
  Star,
  Headphones,
  MapPin,
  Send,
  ListMusic,
  History,
  Flame,
  Zap,
  Gift,
} from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";
import { SongVoting } from "@/components/audio/SongVoting";
import { RadioSubmissionWizard } from "@/components/radio/RadioSubmissionWizard";
import { CompactSubmissions } from "@/components/radio/CompactSubmissions";
import { SongsInRotation } from "@/components/radio/SongsInRotation";
import { RadioInvitations } from "@/components/radio/RadioInvitations";

import type { Database } from "@/lib/supabase-types";

type RadioStationRow = Database["public"]["Tables"]["radio_stations"]["Row"];
type RadioShowRow = Database["public"]["Tables"]["radio_shows"]["Row"];
type RadioSubmissionRow = Database["public"]["Tables"]["radio_submissions"]["Row"];
type SongRow = Database["public"]["Tables"]["songs"]["Row"];

type RadioStationRecord = RadioStationRow & {
  cities?: { name: string | null; country: string | null } | null;
};

type NowPlayingRecord = {
  id: string;
  played_at: string | null;
  listeners: number | null;
  hype_gained: number | null;
  streams_boost: number | null;
  songs?: {
    id: string;
    title: string | null;
    genre: string | null;
    audio_url: string | null;
    audio_generation_status: string | null;
    bands?: { id: string; name: string | null } | null;
  } | null;
  radio_shows?: { id: string; show_name: string | null } | null;
};

type ProfileWithBand = {
  id: string;
  display_name: string | null;
  bands?:
    | null
    | Array<{ id: string; name: string | null; fame: number | null }>
    | { id: string; name: string | null; fame: number | null };
};

const FILTERS = [
  { label: "All", value: "all" as const },
  { label: "National", value: "national" as const },
  { label: "Local", value: "local" as const },
];

type StationFilter = (typeof FILTERS)[number]["value"];
type TabValue = "submit" | "submissions" | "invitations" | "analytics" | "history" | "trending";

const formatDateTime = (value: string | null) => {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getUtcWeekStart = (date: Date) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = utc.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  return utc.toISOString().split("T")[0];
};

const normaliseGenre = (value: string | null | undefined) => value?.toLowerCase().trim() ?? "";

const getStatusIcon = (status: string | null) => {
  switch (status) {
    case "accepted":
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-amber-500" />;
  }
};

export default function Radio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [filter, setFilter] = useState<StationFilter>("all");
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabValue>("submit");

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) setUser(data.user ?? null);
    }).finally(() => {
      if (isMounted) setLoadingUser(false);
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!loadingUser && !user) navigate("/auth");
  }, [loadingUser, user, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("radio-selected-station");
    if (stored) setSelectedStation(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedStation) {
      window.localStorage.setItem("radio-selected-station", selectedStation);
    } else {
      window.localStorage.removeItem("radio-selected-station");
    }
  }, [selectedStation]);

  // Profile query with staleTime
  const { data: profile, isLoading: profileLoading } = useQuery<ProfileWithBand | null>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, bands!bands_leader_id_fkey(id, name, fame)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileWithBand | null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Stations query with staleTime
  const { data: stations, isLoading: stationsLoading } = useQuery<RadioStationRecord[]>({
    queryKey: ["radio-stations", filter],
    queryFn: async () => {
      let query = supabase
        .from("radio_stations")
        .select("*, cities(name, country)")
        .eq("is_active", true)
        .order("quality_level", { ascending: false });
      if (filter !== "all") query = query.eq("station_type", filter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RadioStationRecord[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!stations || stations.length === 0) return;
    if (!selectedStation || !stations.some((s) => s.id === selectedStation)) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  const activeStation = useMemo(
    () => stations?.find((s) => s.id === selectedStation) ?? null,
    [stations, selectedStation],
  );

  // Shows query - only fetch when needed
  const { data: shows, isLoading: showsLoading } = useQuery<RadioShowRow[]>({
    queryKey: ["radio-shows", selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const { data, error } = await supabase
        .from("radio_shows")
        .select("*")
        .eq("station_id", selectedStation)
        .eq("is_active", true)
        .order("time_slot", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RadioShowRow[];
    },
    enabled: !!selectedStation,
    staleTime: 10 * 60 * 1000,
  });

  // Now playing - only on submit/analytics tabs
  const { data: nowPlaying, isLoading: nowPlayingLoading } = useQuery<NowPlayingRecord | null>({
    queryKey: ["now-playing", selectedStation],
    queryFn: async () => {
      if (!selectedStation) return null;
      const { data, error } = await supabase
        .from("radio_plays")
        .select(`id, played_at, listeners, hype_gained, streams_boost,
          songs(id, title, genre, audio_url, audio_generation_status, bands(id, name)),
          radio_shows(id, show_name)`)
        .eq("station_id", selectedStation)
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as NowPlayingRecord | null) ?? null;
    },
    enabled: !!selectedStation && (activeTab === "submit" || activeTab === "analytics"),
    staleTime: 2 * 60 * 1000,
  });

  // Recorded songs - fetch songs with status 'recorded' (simplified query)
  const { data: releasedSongs, isLoading: songsLoading } = useQuery<any[]>({
    queryKey: ["recorded-songs-for-radio", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get user's recorded songs directly - much simpler and faster
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, band_id")
        .eq("user_id", user.id)
        .eq("status", "recorded")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return songs || [];
    },
    enabled: !!user?.id && activeTab === "submit",
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!releasedSongs || releasedSongs.length === 0) {
      setSelectedSong("");
      return;
    }
    if (selectedSong && releasedSongs.some((song: any) => song.id === selectedSong)) return;
    setSelectedSong(releasedSongs[0].id);
  }, [releasedSongs, selectedSong]);

  const selectedSongData = useMemo(
    () => releasedSongs?.find((song: any) => song.id === selectedSong) ?? null,
    [releasedSongs, selectedSong],
  );

  const acceptedGenres = useMemo(
    () => (activeStation?.accepted_genres ?? []).map((g) => g.toLowerCase()),
    [activeStation?.accepted_genres],
  );

  const genreMatches = useMemo(() => {
    if (!selectedSongData) return true;
    if (!acceptedGenres.length) return true;
    const songGenre = normaliseGenre(selectedSongData.genre);
    return songGenre ? acceptedGenres.includes(songGenre) : false;
  }, [acceptedGenres, selectedSongData]);

  // Submissions - lazy load
  const { data: submissions, isLoading: submissionsLoading } = useQuery<RadioSubmissionRow[]>({
    queryKey: ["my-radio-submissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("radio_submissions")
        .select("id, status, submitted_at, reviewed_at, rejection_reason, station_id, song_id, songs(title), radio_stations(name)")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user?.id && activeTab === "submissions",
    staleTime: 2 * 60 * 1000,
  });

  // Top songs - lazy load with audio fields
  const { data: topSongs, isLoading: topSongsLoading } = useQuery({
    queryKey: ["radio-top-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, hype, audio_url, audio_generation_status, profiles(display_name), bands(name)")
        .order("hype", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: activeTab === "trending",
    staleTime: 5 * 60 * 1000,
  });

  // Recent plays - lazy load with audio
  const { data: recentPlays, isLoading: recentPlaysLoading } = useQuery({
    queryKey: ["radio-recent-plays", selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const { data, error } = await supabase
        .from("radio_plays")
        .select(`id, played_at, listeners, hype_gained, streams_boost,
          songs(id, title, genre, quality_score, audio_url, audio_generation_status, bands(name)),
          radio_shows(show_name, host_name)`)
        .eq("station_id", selectedStation)
        .order("played_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedStation && activeTab === "history",
    staleTime: 2 * 60 * 1000,
  });

  // Station stats - lazy load
  const { data: stationStats, isLoading: statsLoading } = useQuery({
    queryKey: ["station-stats", selectedStation],
    queryFn: async () => {
      if (!selectedStation) return null;
      const { data, error } = await supabase
        .from("radio_plays")
        .select("listeners, hype_gained, streams_boost")
        .eq("station_id", selectedStation)
        .gte("played_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const totalListeners = data.reduce((sum, p) => sum + (p.listeners || 0), 0);
      const totalHype = data.reduce((sum, p) => sum + (p.hype_gained || 0), 0);
      const totalStreams = data.reduce((sum, p) => sum + (p.streams_boost || 0), 0);

      return {
        totalPlays: data.length,
        avgListeners: Math.round(totalListeners / data.length),
        totalHype,
        totalStreams,
        last7Days: data.length,
      };
    },
    enabled: !!selectedStation && activeTab === "analytics",
    staleTime: 5 * 60 * 1000,
  });

  const submitSong = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in to submit a song.");
      if (!selectedStation) throw new Error("Choose a radio station before submitting.");
      if (!selectedSongData) throw new Error("Select one of your recorded songs to submit.");
      if (!genreMatches) throw new Error("This station is not accepting the selected song's genre right now.");

      const weekStart = getUtcWeekStart(new Date());

      const { data: existing } = await supabase
        .from("radio_submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("station_id", selectedStation)
        .eq("week_submitted", weekStart);

      if (existing && existing.length > 0) {
        throw new Error("You've already submitted a song to this station this week.");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("radio_submissions")
        .insert({
          song_id: selectedSongData.id,
          station_id: selectedStation,
          user_id: user.id,
          band_id: selectedSongData.band_id ?? null,
          release_id: selectedSongData.release_id ?? null,
          status: "pending",
          submitted_at: new Date().toISOString(),
          week_submitted: weekStart,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);
      if (!inserted) throw new Error("Submission could not be created.");

      const { data: summary, error: rpcError } = await (supabase.rpc as any)(
        "process_radio_submission",
        { p_submission_id: inserted.id }
      );

      if (rpcError) throw new Error(rpcError.message);
      return summary;
    },
    onSuccess: (summary) => {
      if (summary && typeof summary === 'object' && 'listeners' in summary) {
        toast.success("Your song hit the airwaves!", {
          description: `Listeners: ${(summary.listeners || 0).toLocaleString()} · Streams Boost: ${(summary.streams_boost || 0).toLocaleString()}`,
        });
      } else {
        toast.success("Your song has been submitted to the radio station!");
      }
      queryClient.invalidateQueries({ queryKey: ["my-radio-submissions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["now-playing", selectedStation] });
      queryClient.invalidateQueries({ queryKey: ["radio-recent-plays", selectedStation] });
      queryClient.invalidateQueries({ queryKey: ["station-stats", selectedStation] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to submit your song right now.";
      toast.error("Radio submission failed", { description: message });
    },
  });

  const primaryBand = useMemo(() => {
    const bands = profile?.bands;
    if (!bands) return null;
    return Array.isArray(bands) ? bands[0] ?? null : bands;
  }, [profile?.bands]);

  if (loadingUser || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-stage">
      <div className="container mx-auto space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <RadioIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          <div>
            <h1 className="font-oswald text-2xl sm:text-4xl">{t('radio.title')}</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {t('radio.description')}
            </p>
          </div>
        </div>

        <Alert className="py-2">
          <Music className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('radio.submitInfo')}
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
          {/* Mobile-optimized tabs with horizontal scroll */}
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max min-w-full gap-1 sm:grid sm:w-full sm:grid-cols-6">
              <TabsTrigger value="submit" className="flex items-center gap-1.5 px-3 sm:px-4">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{t('radio.submit')}</span>
              </TabsTrigger>
              <TabsTrigger value="submissions" className="flex items-center gap-1.5 px-3 sm:px-4">
                <ListMusic className="h-4 w-4" />
                <span className="hidden sm:inline">{t('radio.submissions')}</span>
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex items-center gap-1.5 px-3 sm:px-4">
                <Gift className="h-4 w-4" />
                <span className="hidden sm:inline">Invitations</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-1.5 px-3 sm:px-4">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('radio.analytics')}</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1.5 px-3 sm:px-4">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">{t('radio.history')}</span>
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex items-center gap-1.5 px-3 sm:px-4">
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">{t('radio.trending')}</span>
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="sm:hidden" />
          </ScrollArea>

          {/* Submit Tab */}
          <TabsContent value="submit" className="mt-4 space-y-4">
            {/* Batch Submit Option */}
            {primaryBand && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{t('radio.submitToAllEligible')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('radio.batchSubmitDesc')}
                      </p>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="default" className="w-full sm:w-auto">
                        <Send className="mr-2 h-4 w-4" />
                        {t('radio.batchSubmit')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <RadioSubmissionWizard 
                        bandId={primaryBand.id} 
                        onComplete={() => {
                          queryClient.invalidateQueries({ queryKey: ["my-radio-submissions"] });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('radio.chooseStation')}</CardTitle>
                <CardDescription className="text-sm">{t('radio.findSlot')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter buttons - horizontal scroll on mobile */}
                <ScrollArea className="w-full">
                  <div className="flex gap-2">
                    {FILTERS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={filter === opt.value ? "default" : "outline"}
                        onClick={() => setFilter(opt.value)}
                        className="whitespace-nowrap"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Station grid */}
                {stationsLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Card key={i} className="border-dashed">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-5 w-2/3" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : !stations?.length ? (
                  <Alert>
                    <AlertTitle>{t('radio.noStationsAvailable')}</AlertTitle>
                    <AlertDescription>{t('radio.checkBackSoon')}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stations.map((station) => (
                      <Card
                        key={station.id}
                        className={`cursor-pointer transition-all hover:border-primary/50 ${
                          selectedStation === station.id ? "border-primary ring-1 ring-primary/20" : ""
                        }`}
                        onClick={() => setSelectedStation(station.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="truncate text-base">{station.name}</CardTitle>
                              <CardDescription className="text-xs">{station.frequency || "Unlisted"}</CardDescription>
                            </div>
                            <Badge variant="secondary" className="shrink-0 text-xs uppercase">
                              {station.station_type}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Listeners</span>
                            <span className="font-medium">{station.listener_base.toLocaleString()}</span>
                          </div>
                          {station.accepted_genres?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {station.accepted_genres.slice(0, 3).map((g) => (
                                <Badge key={g} variant="outline" className="text-xs">
                                  {g}
                                </Badge>
                              ))}
                              {station.accepted_genres.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{station.accepted_genres.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t('radio.submitTrack')}</CardTitle>
                <CardDescription className="text-sm">{t('radio.selectRecordedSong')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!releasedSongs?.length ? (
                  <Alert>
                    <AlertTitle>{t('radio.noRecordedSongsYet')}</AlertTitle>
                    <AlertDescription>
                      {t('radio.finishRecording')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('radio.recordedSong')}</label>
                      <Select value={selectedSong} onValueChange={setSelectedSong} disabled={submitSong.isPending}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('radio.selectASong')} />
                        </SelectTrigger>
                        <SelectContent>
                          {releasedSongs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSongData?.genre && (
                        <p className="text-xs text-muted-foreground">
                          Genre: {selectedSongData.genre} • Quality: {selectedSongData.quality_score ?? "–"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('radio.activeShows')}</label>
                      <div className="rounded-md border bg-background/60 p-2 text-sm">
                        {showsLoading ? (
                          <Skeleton className="h-4 w-32" />
                        ) : shows?.length ? (
                          <ul className="space-y-1">
                            {shows.slice(0, 3).map((show) => (
                              <li key={show.id} className="flex justify-between text-xs">
                                <span>{show.show_name}</span>
                                <span className="text-muted-foreground">{show.time_slot?.replace(/_/g, " ")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t('radio.noActiveShows')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeStation && !!activeStation.accepted_genres?.length && (
                  <Alert variant={genreMatches ? "default" : "destructive"} className="py-2">
                    {genreMatches ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertDescription className="text-sm">
                      {genreMatches
                        ? `${t('radio.accepting')}: ${activeStation.accepted_genres.join(", ")}`
                        : `${t('radio.currentlyFocusedOn')}: ${activeStation.accepted_genres.join(", ")}`}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {primaryBand ? `${t('radio.submittingAs')} ${primaryBand.name ?? "your band"}` : t('radio.createBandForExposure')}
                  </p>
                  <Button
                    onClick={() => submitSong.mutate()}
                    disabled={!selectedStation || !selectedSongData || submitSong.isPending || !genreMatches}
                    className="w-full sm:w-auto"
                  >
                    {submitSong.isPending ? t('radio.submitting') : t('radio.submitToRadio')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Now Playing Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  {t('radio.nowPlaying')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nowPlayingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : nowPlaying ? (
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">{nowPlaying.songs?.title ?? "Untitled"}</p>
                      <p className="text-sm text-muted-foreground">
                        {nowPlaying.songs?.genre ?? "Unknown"} • {nowPlaying.songs?.bands?.name ?? "Independent"}
                      </p>
                    </div>
                    
                    {(nowPlaying.songs?.audio_url || nowPlaying.songs?.audio_generation_status) && (
                      <div className="space-y-2">
                        <SongPlayer
                          audioUrl={nowPlaying.songs.audio_url}
                          generationStatus={nowPlaying.songs.audio_generation_status}
                          compact
                        />
                        {nowPlaying.songs.id && <SongVoting songId={nowPlaying.songs.id} compact />}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md border bg-background/60 p-2">
                        <p className="text-lg font-bold text-emerald-500">{(nowPlaying.listeners ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{t('radio.listeners')}</p>
                      </div>
                      <div className="rounded-md border bg-background/60 p-2">
                        <p className="text-lg font-bold text-amber-500">{nowPlaying.streams_boost ?? 0}</p>
                        <p className="text-xs text-muted-foreground">{t('radio.streams')}</p>
                      </div>
                      <div className="rounded-md border bg-background/60 p-2">
                        <p className="text-lg font-bold text-blue-500">{nowPlaying.hype_gained ?? 0}</p>
                        <p className="text-xs text-muted-foreground">{t('radio.hype')}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('radio.noSpinsYet')}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submissions Tab - Compact with filters */}
          <TabsContent value="submissions" className="mt-4 space-y-4">
            <CompactSubmissions 
              submissions={submissions || []} 
              isLoading={submissionsLoading} 
            />
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations" className="mt-4 space-y-4">
            {primaryBand ? (
              <RadioInvitations bandId={primaryBand.id} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No band found</p>
                  <p className="text-sm">Create or join a band to receive radio invitations</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            {!activeStation ? (
              <Alert>
                <AlertTitle>Select a Station</AlertTitle>
                <AlertDescription>Choose a station to view analytics.</AlertDescription>
              </Alert>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <BarChart3 className="h-5 w-5" />
                          {activeStation.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {activeStation.frequency} FM • {activeStation.station_type === 'national' ? 'National' : 'Local'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="w-fit">
                        <Signal className="mr-1 h-3 w-3" />
                        Level {activeStation.quality_level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats grid - responsive */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-lg font-bold">{activeStation.listener_base.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Listener Base</p>
                        </CardContent>
                      </Card>
                      {statsLoading ? (
                        <>
                          <Skeleton className="h-20" />
                          <Skeleton className="h-20" />
                          <Skeleton className="h-20" />
                        </>
                      ) : stationStats ? (
                        <>
                          <Card>
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <Headphones className="h-4 w-4 text-emerald-500" />
                                <span className="text-lg font-bold">{stationStats.avgListeners.toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Avg Listeners</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-amber-500" />
                                <span className="text-lg font-bold">{stationStats.totalHype.toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Total Hype</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <PlayCircle className="h-4 w-4 text-blue-500" />
                                <span className="text-lg font-bold">{stationStats.last7Days}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Plays (7d)</p>
                            </CardContent>
                          </Card>
                        </>
                      ) : (
                        <Card className="col-span-3">
                          <CardContent className="flex items-center justify-center p-4">
                            <p className="text-sm text-muted-foreground">No data for the past week</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Station details */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Station Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <Badge variant="secondary" className="uppercase">{activeStation.station_type}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Location</span>
                            <span className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3" />
                              {activeStation.station_type === 'national' 
                                ? activeStation.country || 'International'
                                : `${activeStation.cities?.name ?? 'Unknown'}`
                              }
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Active Shows</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {showsLoading ? (
                            <Skeleton className="h-12 w-full" />
                          ) : shows && shows.length > 0 ? (
                            <div className="space-y-2">
                              {shows.slice(0, 3).map((show) => (
                                <div key={show.id} className="flex justify-between text-sm">
                                  <span className="font-medium">{show.show_name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {show.time_slot?.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No active shows</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Accepted genres */}
                    {activeStation.accepted_genres?.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Accepted Genres</p>
                        <div className="flex flex-wrap gap-2">
                          {activeStation.accepted_genres.map((g) => (
                            <Badge key={g} variant="secondary" className="px-2 py-1">
                              <Music className="mr-1 h-3 w-3" />
                              {g}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Now playing in analytics */}
                {nowPlaying && (
                  <Card className="border-primary/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <PlayCircle className="h-5 w-5 text-primary" />
                        Now Playing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold">{nowPlaying.songs?.title || 'Unknown'}</h3>
                          <p className="text-sm text-muted-foreground">
                            by {nowPlaying.songs?.bands?.name || 'Unknown Artist'}
                          </p>
                        </div>
                        
                        {(nowPlaying.songs?.audio_url || nowPlaying.songs?.audio_generation_status) && (
                          <div className="space-y-2">
                            <SongPlayer
                              audioUrl={nowPlaying.songs.audio_url}
                              generationStatus={nowPlaying.songs.audio_generation_status}
                              compact
                            />
                            {nowPlaying.songs.id && <SongVoting songId={nowPlaying.songs.id} compact />}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xl font-bold text-emerald-500">{(nowPlaying.listeners || 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Listeners</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-amber-500">{nowPlaying.hype_gained || 0}</p>
                            <p className="text-xs text-muted-foreground">Hype</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-blue-500">{nowPlaying.streams_boost || 0}</p>
                            <p className="text-xs text-muted-foreground">Streams</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Songs in Rotation */}
                {user && <SongsInRotation userId={user.id} />}
              </>
            )}
          </TabsContent>

          {/* History Tab with Audio */}
          <TabsContent value="history" className="mt-4 space-y-4">
            {!activeStation ? (
              <Alert>
                <AlertTitle>Select a Station</AlertTitle>
                <AlertDescription>Choose a station to view play history.</AlertDescription>
              </Alert>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    Recent Plays - {activeStation.name}
                  </CardTitle>
                  <CardDescription className="text-sm">Last 20 songs played</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentPlaysLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : recentPlays && recentPlays.length > 0 ? (
                    <div className="space-y-3">
                      {recentPlays.map((play: any, idx: number) => (
                        <div key={play.id} className="rounded-lg border p-3 transition-colors hover:bg-accent/50">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              <Badge variant="outline" className="mt-0.5 shrink-0">
                                #{idx + 1}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-semibold">{play.songs?.title || 'Unknown'}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {play.songs?.bands?.name || 'Unknown Artist'}
                                  {play.songs?.genre && ` • ${play.songs.genre}`}
                                </p>
                                {play.radio_shows?.show_name && (
                                  <p className="text-xs text-muted-foreground">
                                    Show: {play.radio_shows.show_name}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">{formatDateTime(play.played_at)}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-emerald-500" />
                                <span>{(play.listeners || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-amber-500" />
                                <span>+{play.hype_gained || 0}</span>
                              </div>
                              {play.songs?.quality_score && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                  <span>{play.songs.quality_score}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Audio player for history items with tracking */}
                          {(play.songs?.audio_url || play.songs?.audio_generation_status) && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                              <TrackableSongPlayer
                                songId={play.songs.id}
                                audioUrl={play.songs.audio_url}
                                generationStatus={play.songs.audio_generation_status}
                                title={play.songs.title}
                                artist={play.songs?.bands?.name}
                                compact
                                source="radio_history"
                              />
                              {play.songs?.id && <SongVoting songId={play.songs.id} compact />}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Music className="h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-sm text-muted-foreground">No plays recorded yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Trending Tab with Audio */}
          <TabsContent value="trending" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Trending Songs
                </CardTitle>
                <CardDescription className="text-sm">Top tracks dominating the airwaves this week.</CardDescription>
              </CardHeader>
              <CardContent>
                {topSongsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : !topSongs?.length ? (
                  <Alert>
                    <AlertTitle>No trending data</AlertTitle>
                    <AlertDescription>Check back after the first wave of spins.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {topSongs.map((song: any, index: number) => (
                      <div
                        key={song.id}
                        className="rounded-lg border bg-background/60 p-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${
                              index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{song.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {song.bands?.name || song.profiles?.display_name || "Unknown Artist"}
                              </p>
                              {song.genre && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {song.genre}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Flame className="h-3 w-3 text-orange-500" />
                              {song.hype ?? 0} Hype
                            </Badge>
                          </div>
                        </div>

                        {/* Audio player and voting for trending songs with tracking */}
                        {(song.audio_url || song.audio_generation_status) && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            <TrackableSongPlayer
                              songId={song.id}
                              audioUrl={song.audio_url}
                              generationStatus={song.audio_generation_status}
                              title={song.title}
                              artist={song.bands?.name || song.profiles?.display_name}
                              compact
                              source="radio_trending"
                            />
                            <SongVoting songId={song.id} compact />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
