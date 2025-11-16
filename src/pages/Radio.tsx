import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

import type { Database } from "@/lib/supabase-types";

type RadioStationRow = Database["public"]["Tables"]["radio_stations"]["Row"];
type RadioShowRow = Database["public"]["Tables"]["radio_shows"]["Row"];
type RadioSubmissionRow = Database["public"]["Tables"]["radio_submissions"]["Row"];
type SongRow = Database["public"]["Tables"]["songs"]["Row"];
type ProcessRadioSubmissionSummary = any; // RPC function return type

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
    bands?: { id: string; name: string | null } | null;
  } | null;
  radio_shows?: { id: string; show_name: string | null } | null;
};

type RecordedSong = Pick<SongRow, "id" | "title" | "genre" | "quality_score" | "band_id">;

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

const formatDateTime = (value: string | null) => {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "–";
  }
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [filter, setFilter] = useState<StationFilter>("all");
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"submit" | "submissions" | "trending">("submit");

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (isMounted) {
          setUser(data.user ?? null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingUser(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loadingUser && !user) {
      navigate("/auth");
    }
  }, [loadingUser, user, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("radio-selected-station");
    if (stored) {
      setSelectedStation(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedStation) {
      window.localStorage.setItem("radio-selected-station", selectedStation);
    } else {
      window.localStorage.removeItem("radio-selected-station");
    }
  }, [selectedStation]);

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
  });

  const { data: stations, isLoading: stationsLoading } = useQuery<RadioStationRecord[]>({
    queryKey: ["radio-stations", filter],
    queryFn: async () => {
      let query = supabase
        .from("radio_stations")
        .select("*, cities(name, country)")
        .eq("is_active", true)
        .order("quality_level", { ascending: false });

      if (filter !== "all") {
        query = query.eq("station_type", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RadioStationRecord[];
    },
  });

  useEffect(() => {
    if (!stations || stations.length === 0) return;
    if (!selectedStation || !stations.some((station) => station.id === selectedStation)) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  const activeStation = useMemo(
    () => stations?.find((station) => station.id === selectedStation) ?? null,
    [stations, selectedStation],
  );

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
  });

  const { data: nowPlaying, isLoading: nowPlayingLoading } = useQuery<NowPlayingRecord | null>({
    queryKey: ["now-playing", selectedStation],
    queryFn: async () => {
      if (!selectedStation) return null;
      const { data, error } = await supabase
        .from("radio_plays")
        .select(
          `id, played_at, listeners, hype_gained, streams_boost,
          songs(id, title, genre, bands(id, name)),
          radio_shows(id, show_name)`
        )
        .eq("station_id", selectedStation)
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as NowPlayingRecord | null) ?? null;
    },
    enabled: !!selectedStation,
  });

  const { data: recordedSongs, isLoading: songsLoading } = useQuery<RecordedSong[]>({
    queryKey: ["recorded-songs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, band_id")
        .eq("user_id", user.id)
        .eq("status", "recorded")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecordedSong[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!recordedSongs || recordedSongs.length === 0) {
      setSelectedSong("");
      return;
    }
    if (selectedSong && recordedSongs.some((song) => song.id === selectedSong)) {
      return;
    }
    setSelectedSong(recordedSongs[0].id);
  }, [recordedSongs, selectedSong]);

  const selectedSongData = useMemo(
    () => recordedSongs?.find((song) => song.id === selectedSong) ?? null,
    [recordedSongs, selectedSong],
  );

  const acceptedGenres = useMemo(
    () => (activeStation?.accepted_genres ?? []).map((genre) => genre.toLowerCase()),
    [activeStation?.accepted_genres],
  );

  const genreMatches = useMemo(() => {
    if (!selectedSongData) return true;
    if (!acceptedGenres.length) return true;
    const songGenre = normaliseGenre(selectedSongData.genre);
    return songGenre ? acceptedGenres.includes(songGenre) : false;
  }, [acceptedGenres, selectedSongData]);

  const { data: submissions, isLoading: submissionsLoading } = useQuery<RadioSubmissionRow[]>({
    queryKey: ["my-radio-submissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("radio_submissions")
        .select(
          "id, status, submitted_at, reviewed_at, rejection_reason, station_id, song_id, songs(title), radio_stations(name)"
        )
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  const { data: topSongs, isLoading: topSongsLoading } = useQuery({
    queryKey: ["radio-top-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, hype, profiles(display_name)")
        .order("hype", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  // New: Fetch station's recent plays history
  const { data: recentPlays, isLoading: recentPlaysLoading } = useQuery({
    queryKey: ["radio-recent-plays", selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const { data, error } = await supabase
        .from("radio_plays")
        .select(`
          id, 
          played_at, 
          listeners, 
          hype_gained, 
          streams_boost,
          songs(id, title, genre, quality_score, bands(name)),
          radio_shows(show_name, host_name)
        `)
        .eq("station_id", selectedStation)
        .order("played_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedStation,
  });

  // New: Fetch station analytics
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

      const totalListeners = data.reduce((sum, play) => sum + (play.listeners || 0), 0);
      const totalHype = data.reduce((sum, play) => sum + (play.hype_gained || 0), 0);
      const totalStreams = data.reduce((sum, play) => sum + (play.streams_boost || 0), 0);
      const avgListeners = Math.round(totalListeners / data.length);

      return {
        totalPlays: data.length,
        avgListeners,
        totalHype,
        totalStreams,
        last7Days: data.length,
      };
    },
    enabled: !!selectedStation,
  });

  const submitSong = useMutation({
    mutationFn: async (): Promise<ProcessRadioSubmissionSummary> => {
      if (!user) {
        throw new Error("You must be signed in to submit a song.");
      }
      if (!selectedStation) {
        throw new Error("Choose a radio station before submitting.");
      }
      if (!selectedSongData) {
        throw new Error("Select one of your recorded songs to submit.");
      }
      if (!genreMatches) {
        throw new Error("This station is not accepting the selected song's genre right now.");
      }

      const weekStart = getUtcWeekStart(new Date());

      const { data: existing, error: existingError } = await supabase
        .from("radio_submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("station_id", selectedStation)
        .eq("week_submitted", weekStart);

      if (existingError) {
        throw new Error(existingError.message);
      }

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
          status: "pending",
          submitted_at: new Date().toISOString(),
          week_submitted: weekStart,
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (!inserted) {
        throw new Error("Submission could not be created.");
      }

      const { data: summary, error: rpcError } = await (supabase.rpc as any)("process_radio_submission", {
        p_submission_id: inserted.id,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!summary) {
        throw new Error("The radio spin summary was not returned.");
      }

      return summary as ProcessRadioSubmissionSummary;
    },
    onSuccess: (summary) => {
      toast.success("Your song hit the airwaves!", {
        description: `Listeners: ${summary.listeners.toLocaleString()} · Streams Boost: ${summary.streams_boost.toLocaleString()}`,
      });
      queryClient.invalidateQueries({ queryKey: ["my-radio-submissions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["now-playing", selectedStation] });
      queryClient.invalidateQueries({ queryKey: ["radio-stations", filter] });
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

  const renderStations = () => {
    if (stationsLoading) {
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`station-skeleton-${index}`} className="border-dashed">
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!stations?.length) {
      return (
        <Alert>
          <AlertTitle>No stations available</AlertTitle>
          <AlertDescription>
            Check back soon—radio programmers are lining up new stations.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stations.map((station) => (
          <Card
            key={station.id}
            className={`cursor-pointer transition-colors ${selectedStation === station.id ? "border-primary" : ""}`}
            onClick={() => setSelectedStation(station.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{station.name}</CardTitle>
                  <CardDescription>{station.frequency || "Unlisted frequency"}</CardDescription>
                </div>
                <Badge variant="secondary" className="uppercase">
                  {station.station_type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Listeners</span>
                <span className="font-semibold">{station.listener_base.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span>
                  {station.station_type === "national"
                    ? station.country || "International"
                    : `${station.cities?.name ?? "Unknown"}${station.cities?.country ? `, ${station.cities.country}` : ""}`}
                </span>
              </div>
              {!!station.accepted_genres?.length && (
                <div>
                  <span className="text-muted-foreground">Accepting</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {station.accepted_genres.map((genre) => (
                      <Badge key={`${station.id}-${genre}`} variant="outline">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-stage">
      <div className="container mx-auto space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <RadioIcon className="h-9 w-9" />
          <div>
            <h1 className="font-oswald text-4xl">Radio Airplay</h1>
            <p className="text-muted-foreground">
              Pitch your recorded tracks to curated stations and trigger real-time spins.
            </p>
          </div>
        </div>

        <Alert>
          <Music className="h-4 w-4" />
          <AlertDescription>
            Submit one recorded song per station each week. Accepted submissions immediately generate a radio play, boosting your
            streams, sales, and band fame.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="submit">Submit Song</TabsTrigger>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
            <TabsTrigger value="analytics">Station Analytics</TabsTrigger>
            <TabsTrigger value="history">Play History</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Choose a Station</CardTitle>
                <CardDescription>Find the right slot for your track and review the requirements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((option) => (
                    <Button
                      key={option.value}
                      variant={filter === option.value ? "default" : "outline"}
                      onClick={() => setFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                {renderStations()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Submit Your Track</CardTitle>
                <CardDescription>Stations only accept recorded songs that match their current rotation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!recordedSongs?.length ? (
                  <Alert>
                    <AlertTitle>No recorded songs yet</AlertTitle>
                    <AlertDescription>
                      Finish recording a song in the studio before pitching it to radio programmers.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Recorded Song</label>
                      <Select value={selectedSong} onValueChange={setSelectedSong} disabled={submitSong.isPending}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a recorded song" />
                        </SelectTrigger>
                        <SelectContent>
                          {recordedSongs.map((song) => (
                            <SelectItem key={song.id} value={song.id}>
                              {song.title}
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
                      <label className="text-sm font-medium">Active Shows</label>
                      <div className="rounded-md border bg-background/60 p-3 text-sm">
                        {showsLoading ? (
                          <Skeleton className="h-4 w-32" />
                        ) : shows?.length ? (
                          <ul className="space-y-1">
                            {shows.map((show) => (
                              <li key={show.id} className="flex items-center justify-between">
                                <span className="font-medium">{show.show_name}</span>
                                <span className="text-muted-foreground">{show.time_slot?.replace(/_/g, " ")}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground">No active shows—submissions will queue for rotation.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeStation && !!activeStation.accepted_genres?.length && (
                  <Alert variant={genreMatches ? "default" : "destructive"}>
                    {genreMatches ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertDescription>
                      {genreMatches
                        ? `This station is actively accepting ${activeStation.accepted_genres.join(", ")} submissions.`
                        : `This station is currently focused on ${activeStation.accepted_genres.join(", ")} rotations.`}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {primaryBand ? (
                      <>Submitting as {primaryBand.name ?? "your band"}. Fame: {Math.round((primaryBand.fame ?? 0) * 10) / 10}</>
                    ) : (
                      <>Radio spins grant band fame. Create a band to maximise your exposure.</>
                    )}
                  </div>
                  <Button
                    onClick={() => submitSong.mutate()}
                    disabled={!selectedStation || !selectedSongData || submitSong.isPending || !genreMatches}
                  >
                    {submitSong.isPending ? "Submitting..." : "Submit to Radio"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Now Playing</CardTitle>
                <CardDescription>
                  Accepted submissions spin instantly. Track the latest play from this station.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nowPlayingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : nowPlaying ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <PlayCircle className="h-6 w-6 text-primary" />
                      <div>
                        <p className="text-lg font-semibold">{nowPlaying.songs?.title ?? "Untitled"}</p>
                        <p className="text-sm text-muted-foreground">
                          {nowPlaying.songs?.genre ?? "Unknown"} • {nowPlaying.songs?.bands?.name ?? "Independent Artist"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                      <div className="rounded-md border bg-background/60 p-3">
                        <p className="text-muted-foreground">Listeners</p>
                        <p className="text-lg font-semibold">{nowPlaying.listeners?.toLocaleString() ?? "–"}</p>
                      </div>
                      <div className="rounded-md border bg-background/60 p-3">
                        <p className="text-muted-foreground">Streams Boost</p>
                        <p className="text-lg font-semibold">{nowPlaying.streams_boost?.toLocaleString() ?? "–"}</p>
                      </div>
                      <div className="rounded-md border bg-background/60 p-3">
                        <p className="text-muted-foreground">Hype Gained</p>
                        <p className="text-lg font-semibold">{nowPlaying.hype_gained ?? "–"}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last spin {formatDateTime(nowPlaying.played_at)} on {nowPlaying.radio_shows?.show_name ?? "rotation"}.
                    </p>
                  </div>
                ) : (
                  <Alert>
                    <AlertTitle>No spins yet</AlertTitle>
                    <AlertDescription>
                      Submit a track to trigger the first spin for this station today.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Submission History</CardTitle>
                <CardDescription>Track review outcomes and rotation stats for your pitches.</CardDescription>
              </CardHeader>
              <CardContent>
                {submissionsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={`submission-${index}`} className="h-10 w-full" />
                    ))}
                  </div>
                ) : !submissions?.length ? (
                  <Alert>
                    <AlertTitle>No submissions yet</AlertTitle>
                    <AlertDescription>Submit a song to see it appear in your history.</AlertDescription>
                  </Alert>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Song</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Reviewed</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(submission.status)}
                              <span className="capitalize">{submission.status ?? "pending"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{(submission as any).songs?.title ?? "–"}</TableCell>
                          <TableCell>{(submission as any).radio_stations?.name ?? "–"}</TableCell>
                          <TableCell>{formatDateTime(submission.submitted_at)}</TableCell>
                          <TableCell>{formatDateTime(submission.reviewed_at)}</TableCell>
                          <TableCell className="max-w-xs text-sm text-muted-foreground">
                            {submission.rejection_reason ?? ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {!activeStation ? (
              <Alert>
                <AlertTitle>Select a Station</AlertTitle>
                <AlertDescription>Choose a radio station to view detailed analytics and performance metrics.</AlertDescription>
              </Alert>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          {activeStation.name} - Station Analytics
                        </CardTitle>
                        <CardDescription>
                          {activeStation.frequency} FM • {activeStation.station_type === 'national' ? 'National Coverage' : 'Local Coverage'}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Signal className="h-3 w-3" />
                        Quality Level {activeStation.quality_level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeStation.description && (
                      <p className="mb-6 text-sm text-muted-foreground">{activeStation.description}</p>
                    )}
                    
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Listener Base</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-2xl font-bold">{activeStation.listener_base.toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Total potential reach</p>
                        </CardContent>
                      </Card>

                      {statsLoading ? (
                        <>
                          <Skeleton className="h-32" />
                          <Skeleton className="h-32" />
                          <Skeleton className="h-32" />
                        </>
                      ) : stationStats ? (
                        <>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardDescription>Avg. Listeners / Play</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-2">
                                <Headphones className="h-4 w-4 text-emerald-500" />
                                <span className="text-2xl font-bold">{stationStats.avgListeners.toLocaleString()}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">Last 7 days average</p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-2">
                              <CardDescription>Total Hype Generated</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-amber-500" />
                                <span className="text-2xl font-bold">{stationStats.totalHype.toLocaleString()}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">Past week total</p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-2">
                              <CardDescription>Plays This Week</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-2">
                                <PlayCircle className="h-4 w-4 text-blue-500" />
                                <span className="text-2xl font-bold">{stationStats.last7Days}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">Total spins (7 days)</p>
                            </CardContent>
                          </Card>
                        </>
                      ) : (
                        <Card className="col-span-3">
                          <CardContent className="flex items-center justify-center p-6">
                            <p className="text-sm text-muted-foreground">No play data available for the past week</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Station Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <Badge variant="secondary" className="uppercase">{activeStation.station_type}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Location</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {activeStation.station_type === 'national' 
                                ? activeStation.country || 'International'
                                : `${activeStation.cities?.name ?? 'Unknown'}${activeStation.cities?.country ? `, ${activeStation.cities.country}` : ''}`
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frequency</span>
                            <span className="font-mono">{activeStation.frequency || 'N/A'} FM</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Quality Tier</span>
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3 text-amber-500" />
                              <span>Level {activeStation.quality_level}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Active Shows</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {showsLoading ? (
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-4 w-5/6" />
                            </div>
                          ) : shows && shows.length > 0 ? (
                            <div className="space-y-3">
                              {shows.map((show) => (
                                <div key={show.id} className="border-l-2 border-primary/50 pl-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium">{show.show_name}</p>
                                      <p className="text-xs text-muted-foreground">Host: {show.host_name || 'Various'}</p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {show.time_slot?.replace(/_/g, ' ')}
                                    </Badge>
                                  </div>
                                  {show.description && (
                                    <p className="mt-1 text-xs text-muted-foreground">{show.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No active shows currently scheduled</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {activeStation.accepted_genres && activeStation.accepted_genres.length > 0 && (
                      <Card className="mt-4">
                        <CardHeader>
                          <CardTitle className="text-base">Accepted Genres</CardTitle>
                          <CardDescription>This station currently accepts the following genres for submissions</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {activeStation.accepted_genres.map((genre) => (
                              <Badge key={genre} variant="secondary" className="px-3 py-1">
                                <Music className="mr-1 h-3 w-3" />
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>

                {nowPlaying && (
                  <Card className="border-primary/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5 text-primary" />
                        Now Playing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{nowPlaying.songs?.title || 'Unknown Track'}</h3>
                          <p className="text-sm text-muted-foreground">
                            by {nowPlaying.songs?.bands?.name || 'Unknown Artist'}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-emerald-500">{(nowPlaying.listeners || 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Listeners</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-amber-500">{(nowPlaying.hype_gained || 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Hype</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-blue-500">{(nowPlaying.streams_boost || 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Streams</p>
                          </div>
                        </div>
                        {nowPlaying.radio_shows?.show_name && (
                          <p className="text-xs text-muted-foreground">
                            Playing on: {nowPlaying.radio_shows.show_name}
                          </p>
                        )}
                        {nowPlaying.played_at && (
                          <p className="text-xs text-muted-foreground">
                            Played: {formatDateTime(nowPlaying.played_at)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {!activeStation ? (
              <Alert>
                <AlertTitle>Select a Station</AlertTitle>
                <AlertDescription>Choose a radio station to view its recent play history.</AlertDescription>
              </Alert>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Plays - {activeStation.name}
                  </CardTitle>
                  <CardDescription>Last 20 songs that aired on this station</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentPlaysLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Skeleton key={idx} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : recentPlays && recentPlays.length > 0 ? (
                    <div className="space-y-3">
                      {recentPlays.map((play: any, idx) => (
                        <div 
                          key={play.id} 
                          className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="w-8 justify-center">
                                #{idx + 1}
                              </Badge>
                              <div>
                                <h4 className="font-semibold">{play.songs?.title || 'Unknown'}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {play.songs?.bands?.name || 'Unknown Artist'}
                                  {play.songs?.genre && ` • ${play.songs.genre}`}
                                </p>
                              </div>
                            </div>
                            {play.radio_shows?.show_name && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Show: {play.radio_shows.show_name}
                                {play.radio_shows.host_name && ` (Host: ${play.radio_shows.host_name})`}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDateTime(play.played_at)}
                            </p>
                          </div>
                          <div className="ml-4 flex flex-col items-end gap-1 text-right">
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-3 w-3 text-emerald-500" />
                              <span className="font-medium">{(play.listeners || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              +{play.hype_gained || 0} hype
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <PlayCircle className="h-3 w-3" />
                              +{play.streams_boost || 0} streams
                            </div>
                            {play.songs?.quality_score && (
                              <div className="mt-1 flex items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                <span className="text-xs">{play.songs.quality_score}/100</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Music className="h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-sm text-muted-foreground">No plays recorded yet for this station</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trending Songs</CardTitle>
                <CardDescription>These tracks are dominating the airwaves this week.</CardDescription>
              </CardHeader>
              <CardContent>
                {topSongsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={`top-song-${index}`} className="h-6 w-3/4" />
                    ))}
                  </div>
                ) : !topSongs?.length ? (
                  <Alert>
                    <AlertTitle>No trending data</AlertTitle>
                    <AlertDescription>
                      Come back after the first wave of spins to see which songs are breaking through.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ul className="space-y-3">
                    {topSongs.map((song: any, index: number) => (
                      <li key={song.id} className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                        <div>
                          <p className="font-semibold">
                            {index + 1}. {song.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {song.genre ?? "Unknown genre"} • {song.profiles?.display_name ?? "Unsigned artist"}
                          </p>
                        </div>
                        <Badge variant="secondary">Hype {song.hype ?? 0}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

