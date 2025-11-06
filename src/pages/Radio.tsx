import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Lightbulb,
  ListMusic,
  MapPin,
  Music,
  Radio as RadioIcon,
  Search,
  Waves,
} from "lucide-react";

const enhancementIdeas = [
  "Live listener chat or call-in queue to capture audience engagement in real time.",
  "Station reputation meter that impacts submission acceptance odds and rewards.",
  "Regional heatmap displaying station reach and signal strength by geography.",
  "Ad inventory marketplace where bands can purchase promoted spins or shout-outs.",
  "Syndication tracker showing where shows are rebroadcast across partner stations.",
  "DJ affinity scores that surface hosts most likely to love a band’s genre mix.",
  "Weekly programming calendar with drag-and-drop tools for scheduling new shows.",
  "Audience demographic breakdown estimating age groups and favorite genres.",
  "Historical chart showing how a band’s radio fame changed over time per station.",
  "Integration hooks for live streaming platforms to simulcast radio content.",
];

type RadioStationRecord = {
  id: string;
  name: string;
  frequency: string | null;
  station_type: string;
  listener_base: number;
  quality_level: number;
  accepted_genres: string[] | null;
  country: string | null;
  cities: { name: string | null; country: string | null } | null;
};

type RadioShowRecord = {
  id: string;
  show_name: string;
  host_name: string | null;
  show_genres: string[] | null;
  time_slot: string;
};

type StationPlaySummary = {
  total_spins: number;
  total_listeners: number;
  total_streams: number;
  total_revenue: number;
  total_hype: number;
};

type StationPlayTimelineEntry = {
  play_date: string;
  spins: number;
  revenue: number;
  listeners: number;
  streams: number;
  hype: number;
};

export default function Radio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  // Get current user
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  });
};

export default function Radio() {
  const [typeFilter, setTypeFilter] = useState<"all" | "national" | "local">("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const {
    data: stations = [],
    isLoading: stationsLoading,
    error: stationsError,
  } = useQuery({
    queryKey: ["radio-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_stations")
        .select("id, name, frequency, station_type, listener_base, quality_level, accepted_genres, country, cities(name, country)")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data as RadioStationRecord[]) ?? [];
    },
  });

  const genreOptions = useMemo(() => {
    const unique = new Set<string>();
    stations.forEach((station) => {
      station.accepted_genres?.forEach((genre) => unique.add(genre));
    });
    return Array.from(unique).sort();
  }, [stations]);

  const locationOptions = useMemo(() => {
    const unique = new Set<string>();
    stations.forEach((station) => {
      unique.add(formatLocation(station));
    });
    return Array.from(unique).sort();
  }, [stations]);

  const filteredStations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stations.filter((station) => {
      if (typeFilter !== "all" && station.station_type !== typeFilter) return false;

      if (genreFilter !== "all") {
        const genres = station.accepted_genres ?? [];
        if (!genres.includes(genreFilter)) return false;
      }

      if (locationFilter !== "all") {
        if (formatLocation(station) !== locationFilter) return false;
      }

      if (normalizedSearch) {
        const haystack = `${station.name} ${station.frequency ?? ""} ${station.accepted_genres?.join(" ") ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [stations, typeFilter, genreFilter, locationFilter, searchTerm]);

  useEffect(() => {
    if (!filteredStations.length) {
      setSelectedStationId(null);
      return;
    }

    if (!selectedStationId || !filteredStations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(filteredStations[0].id);
    }
  }, [filteredStations, selectedStationId]);

  const selectedStation = useMemo(
    () => filteredStations.find((station) => station.id === selectedStationId) ?? null,
    [filteredStations, selectedStationId]
  );

  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ["radio-station-shows", selectedStation?.id],
    queryFn: async () => {
      if (!selectedStation) return [];
      const { data, error } = await supabase
        .from("radio_shows")
        .select("id, show_name, host_name, show_genres, time_slot")
        .eq("station_id", selectedStation.id)
        .eq("is_active", true)
        .order("time_slot");

      if (error) throw error;
      return (data as RadioShowRecord[]) ?? [];
    },
    enabled: !!selectedStation?.id,
  });

  const { data: nowPlaying } = useQuery({
    queryKey: ["radio-station-now-playing", selectedStation?.id],
    queryFn: async () => {
      if (!selectedStation) return null;
      const { data, error } = await supabase
        .from("radio_plays")
        .select(
          `id, played_at, listeners, songs(id, title, genre, bands(id, name)), radio_shows(id, show_name)`
        )
        .eq("station_id", selectedStation.id)
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as NowPlayingRecord | null) ?? null;
    },
    enabled: !!selectedStation?.id,
  });

  const showIds = useMemo(() => shows.map((show) => show.id), [shows]);

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ["radio-station-playlists", showIds.sort().join("-")],
    queryFn: async () => {
      if (!showIds.length) return [];
      const { data, error } = await supabase
        .from("radio_playlists")
        .select(
          `id, week_start_date, times_played, added_at, songs(title, genre, bands(name)), radio_shows(id, show_name)`
        )
        .in("show_id", showIds)
        .eq("is_active", true)
        .order("added_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data as RadioPlaylistRecord[]) ?? [];
    },
    enabled: !!showIds.length,
  });

  const { data: recentPlays = [] } = useQuery({
    queryKey: ["radio-station-plays", selectedStation?.id],
    queryFn: async () => {
      if (!selectedStation) return [];
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - 14);

      const { data, error } = await supabase
        .from("radio_plays")
        .select(`song_id, listeners, played_at, songs(title, genre, bands(name))`)
        .eq("station_id", selectedStation.id)
        .gte("played_at", windowStart.toISOString())
        .order("played_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data as RadioPlayRecord[]) ?? [];
    },
    enabled: !!selectedStation?.id,
  });

  const songPopularity = useMemo(() => {
    const map = new Map<
      string,
      { title: string; band: string; genre: string; plays: number; listeners: number }
    >();

    recentPlays.forEach((play) => {
      const key = play.song_id;
      if (!key) return;

      const title = play.songs?.title ?? "Unknown Song";
      const band = play.songs?.bands?.name ?? "Unknown Band";
      const genre = play.songs?.genre ?? "Unknown";

      const entry = map.get(key) ?? { title, band, genre, plays: 0, listeners: 0 };
      entry.plays += 1;
      entry.listeners += play.listeners ?? 0;
      map.set(key, entry);
    });

    return Array.from(map.values())
      .sort((a, b) => (b.plays === a.plays ? b.listeners - a.listeners : b.plays - a.plays))
      .slice(0, 5);
  }, [recentPlays]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const todayPlays = useMemo(
    () =>
      recentPlays.filter((play) => {
        if (!play.played_at) return false;
        return new Date(play.played_at) >= today;
      }),
    [recentPlays, today]
  );

  const dailyRevenueTotal = useMemo(
    () => aggregatedBandRevenue.reduce((sum, band) => sum + band.total, 0),
    [aggregatedBandRevenue]
  );

  const { data: stationPlaySummary } = useQuery<StationPlaySummary | null>({
    queryKey: ['station-play-summary', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return null;

      const { data, error } = await supabase.rpc('get_radio_station_play_summary', {
        p_station_id: selectedStation,
        p_days: 14,
      });

      if (error) throw error;

      const summary = data && data.length > 0 ? data[0] : null;

      return {
        total_spins: Number(summary?.total_spins ?? 0),
        total_listeners: Number(summary?.total_listeners ?? 0),
        total_streams: Number(summary?.total_streams ?? 0),
        total_revenue: Number(summary?.total_revenue ?? 0),
        total_hype: Number(summary?.total_hype ?? 0),
      };
    },
    enabled: !!selectedStation,
  });

  const { data: stationPlayTimeline } = useQuery<StationPlayTimelineEntry[]>({
    queryKey: ['station-play-timeline', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];

      const { data, error } = await supabase.rpc('get_radio_station_play_timeline', {
        p_station_id: selectedStation,
        p_days: 14,
      });

      if (error) throw error;
      return (data as StationPlayTimelineEntry[]) || [];
    },
    enabled: !!selectedStation,
  });

  const fourteenDayTimeline = useMemo(() => {
    if (!selectedStation) return [];

    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 13; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      days.push(day.toISOString().split('T')[0]);
    }

    const timelineMap = new Map(
      (stationPlayTimeline || []).map((entry) => [entry.play_date, entry])
    );

    return days.map((date) => {
      const entry = timelineMap.get(date);

      return {
        date,
        spins: Number(entry?.spins ?? 0),
        revenue: Number(entry?.revenue ?? 0),
        listeners: Number(entry?.listeners ?? 0),
        streams: Number(entry?.streams ?? 0),
        hype: Number(entry?.hype ?? 0),
      };
    });
  }, [stationPlayTimeline, selectedStation]);

  const { data: recordedSongs } = useQuery({
    queryKey: ['recorded-songs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'recorded')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: mySubmissions } = useQuery({
    queryKey: ['my-radio-submissions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radio_submissions')
        .select('*, songs(title, genre), radio_stations(name)')
        .eq('user_id', user?.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: topSongs } = useQuery({
    queryKey: ['top-radio-songs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*, profiles(display_name)')
        .order('hype', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const submitSong = useMutation({
    mutationFn: async () => {
      if (!selectedStation || !selectedSong) {
        throw new Error('Please select a station and song');
      }
    >();

    todayPlays.forEach((play) => {
      const bandName = play.songs?.bands?.name;
      if (!bandName) return;

      const key = bandName.toLowerCase();
      const listeners = play.listeners ?? 0;

      const entry =
        map.get(key) ?? {
          band: bandName,
          plays: 0,
          listeners: 0,
          songs: new Set<string>(),
          revenue: 0,
          fame: 0,
        };

      entry.plays += 1;
      entry.listeners += listeners;
      entry.revenue += listeners * REVENUE_PER_LISTENER;
      entry.fame += FAME_PER_PLAY;
      if (play.songs?.title) {
        entry.songs.add(play.songs.title);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-radio-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['station-now-playing'] });
      queryClient.invalidateQueries({ queryKey: ['band-radio-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['station-play-summary'] });
      queryClient.invalidateQueries({ queryKey: ['station-play-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['top-radio-songs'] });
      toast.success('Your track is now spinning on the airwaves!');
      setSelectedSong('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        songCount: entry.songs.size,
      }))
      .sort((a, b) => (b.revenue === a.revenue ? b.plays - a.plays : b.revenue - a.revenue))
      .slice(0, 6);
  }, [todayPlays]);

  const stationKpis = useMemo(() => {
    if (!recentPlays.length) {
      return {
        totalSpins: 0,
        uniqueSongs: 0,
        totalListeners: 0,
        averageListeners: 0,
        peakListeners: 0,
      };
    }

    const totalListeners = recentPlays.reduce((sum, play) => sum + (play.listeners ?? 0), 0);
    const uniqueSongs = new Set(recentPlays.map((play) => play.song_id)).size;
    const peakListeners = recentPlays.reduce(
      (max, play) => Math.max(max, play.listeners ?? 0),
      0
    );

    return {
      totalSpins: recentPlays.length,
      uniqueSongs,
      totalListeners,
      averageListeners: totalListeners / recentPlays.length,
      peakListeners,
    };
  }, [recentPlays]);

  const networkSummary = useMemo(() => {
    if (!stations.length) {
      return {
        totalStations: 0,
        totalListenerBase: 0,
        averageQuality: 0,
        uniqueGenres: 0,
      };
    }

    const totalListenerBase = stations.reduce((sum, station) => sum + (station.listener_base ?? 0), 0);
    const uniqueGenres = new Set(stations.flatMap((station) => station.accepted_genres ?? [])).size;
    const averageQuality =
      stations.reduce((sum, station) => sum + (station.quality_level ?? 0), 0) / stations.length;

    return {
      totalStations: stations.length,
      totalListenerBase,
      averageQuality,
      uniqueGenres,
    };
  }, [stations]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Radio Network</h1>
        <p className="text-muted-foreground">
          Discover every station in the world of Rockmundo, browse their programming, and monitor
          the songs captivating listeners right now.
        </p>
      </div>

                {selectedStation && (
                  <div className="space-y-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    {stationPlaySummary && (
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-md border border-primary/20 bg-background/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spins (14 days)</p>
                          <p className="text-2xl font-semibold">{stationPlaySummary.total_spins.toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border border-primary/20 bg-background/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listeners reached</p>
                          <p className="text-2xl font-semibold">{stationPlaySummary.total_listeners.toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border border-primary/20 bg-background/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Streams boosted</p>
                          <p className="text-2xl font-semibold">{stationPlaySummary.total_streams.toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border border-primary/20 bg-background/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimated payouts (14 days)</p>
                          <p className="text-2xl font-semibold">{currencyFormatter.format(stationPlaySummary.total_revenue || 0)}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <PlayCircle className="h-6 w-6 text-primary" />
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                          Now Playing
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {activeStation?.name || 'Selected Station'} • {nowPlaying?.radio_shows?.show_name || 'Automated Rotation'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : filteredStations.length
            ? filteredStations.map((station) => (
                <Card
                  key={station.id}
                  className={`cursor-pointer transition ${
                    selectedStationId === station.id ? "border-primary shadow-lg" : "hover:border-primary"
                  }`}
                  onClick={() => setSelectedStationId(station.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-lg">
                      <span>{station.name}</span>
                      <Badge>{station.station_type === "national" ? "National" : "Local"}</Badge>
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Waves className="h-4 w-4" /> {station.frequency ?? "Unknown frequency"}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4" /> {formatLocation(station)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-1">
                        <div className="font-medium">Listener Base</div>
                        <div className="text-muted-foreground">{formatNumber(station.listener_base)} fans</div>
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="font-medium">Broadcast Quality</div>
                        <div className="text-muted-foreground">Level {station.quality_level}</div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Accepted genres</div>
                      <div className="flex flex-wrap gap-2">
                        {(station.accepted_genres ?? ["Open format"]).map((genre) => (
                          <Badge key={genre} variant="outline">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-primary/20 bg-background/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4 text-primary" />
                          14-Day Spin Timeline
                        </div>
                        <span className="text-xs text-muted-foreground">Aggregated from all spins in the last 14 days</span>
                      </div>
                      {fourteenDayTimeline.length > 0 ? (
                        <div className="mt-3 grid gap-2 text-xs">
                          {fourteenDayTimeline.map((day) => (
                            <div
                              key={day.date}
                              className="flex items-center justify-between rounded-md border border-border/60 bg-background/90 px-3 py-2"
                            >
                              <span className="font-medium">
                                {new Date(day.date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <div className="flex flex-wrap items-center gap-4">
                                <span className="text-muted-foreground">
                                  {day.spins} spin{day.spins === 1 ? '' : 's'}
                                </span>
                                <span className="text-muted-foreground">
                                  {day.listeners.toLocaleString()} listeners
                                </span>
                                <span className="font-semibold">
                                  {currencyFormatter.format(day.revenue || 0)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          No spins recorded in the last 14 days.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedStation && shows && shows.length > 0 && (
                  <div className="pt-4">
                    <h3 className="text-lg font-semibold mb-2">Shows on this station:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {shows.map((show) => (
                        <div key={show.id} className="p-3 border rounded-lg">
                          <p className="font-medium">{show.show_name}</p>
                          <p className="text-sm text-muted-foreground">Host: {show.host_name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {show.show_genres?.map((genre: string) => (
                              <Badge key={genre} variant="outline" className="text-xs">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {nowPlaying.radio_shows?.show_name ? `During ${nowPlaying.radio_shows.show_name}` : "Unscheduled spin"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {nowPlaying.played_at ? `Last updated ${formatDate(nowPlaying.played_at)}` : "Play time unavailable"}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">No recent play data for this station.</div>
                )}
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
                  <p className="uppercase tracking-wide text-muted-foreground">Spins (14 days)</p>
                  <p className="mt-1 text-xl font-semibold">{formatNumber(stationKpis.totalSpins)}</p>
                </div>
                <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
                  <p className="uppercase tracking-wide text-muted-foreground">Unique Songs</p>
                  <p className="mt-1 text-xl font-semibold">{formatNumber(stationKpis.uniqueSongs)}</p>
                </div>
                <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
                  <p className="uppercase tracking-wide text-muted-foreground">Avg. Audience</p>
                  <p className="mt-1 text-xl font-semibold">
                    {stationKpis.averageListeners ? stationKpis.averageListeners.toFixed(0) : "–"}
                  </p>
                </div>
                <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
                  <p className="uppercase tracking-wide text-muted-foreground">Peak Listeners</p>
                  <p className="mt-1 text-xl font-semibold">{formatNumber(stationKpis.peakListeners)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListMusic className="h-5 w-5" /> Current shows
              </CardTitle>
              <CardDescription>Who is on the air and what they’re spinning this season.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showsLoading ? (
                <div className="text-sm text-muted-foreground">Loading shows...</div>
              ) : shows.length ? (
                shows.map((show) => (
                  <div key={show.id} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">{show.show_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Hosted by {show.host_name ?? "TBA"} • {show.time_slot}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {(show.show_genres ?? []).map((genre) => (
                        <Badge key={genre} variant="secondary">
                          {genre}
                        </Badge>
                      ))}
                      {!show.show_genres?.length && <span>No genres listed</span>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No active shows are scheduled for this station.</div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" /> Song popularity snapshot
              </CardTitle>
              <CardDescription>
                Aggregated from the last two weeks of spins to highlight what listeners keep requesting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {songPopularity.length ? (
                songPopularity.map((song, index) => (
                  <div key={`${song.title}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
                    <div>
                      <div className="font-semibold">{song.title}</div>
                      <div className="text-xs text-muted-foreground">{song.band} • {song.genre}</div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <div>
                        <div className="font-semibold text-base leading-none">{song.plays}</div>
                        <div>Spins</div>
                      </div>
                      <div>
                        <div className="font-semibold text-base leading-none">{formatNumber(song.listeners)}</div>
                        <div>Listeners</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">Not enough recent plays to build popularity stats.</div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" /> Daily band payouts & fame
              </CardTitle>
              <CardDescription>
                Estimated royalties and notoriety earned from today’s confirmed spins on this station.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bandDailyEarnings.length ? (
                <div className="grid gap-3">
                  {bandDailyEarnings.map((entry) => (
                    <div
                      key={entry.band}
                      className="grid gap-4 rounded-lg border border-muted/60 bg-background/60 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr]"
                    >
                      <div className="space-y-1 text-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Band</p>
                        <p className="text-base font-semibold">{entry.band}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.songCount} song{entry.songCount === 1 ? "" : "s"} in rotation today
                        </p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Spins</p>
                        <p className="text-base font-semibold">{entry.plays}</p>
                        <p className="text-xs text-muted-foreground">Across {formatNumber(entry.listeners)} listeners</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily Revenue</p>
                        <p className="text-base font-semibold">{formatCurrency(entry.revenue)}</p>
                        <p className="text-xs text-muted-foreground">
                          Calculated at {formatNumber(REVENUE_PER_LISTENER, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 })} per listener
                        </p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Fame</p>
                        <p className="text-base font-semibold">{entry.fame.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">{FAME_PER_PLAY.toFixed(1)} per confirmed spin</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No plays recorded so far today. Keep an eye on the airwaves as the broadcast day unfolds.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Waves className="h-5 w-5" /> Latest spins timeline
              </CardTitle>
              <CardDescription>Recent airplay history to understand programming cadence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {recentPlays.length ? (
                recentPlays.slice(0, 8).map((play) => {
                  const playedAt = play.played_at ? new Date(play.played_at) : null;

                  return (
                    <div key={`${play.song_id}-${play.played_at}`} className="space-y-1 rounded-lg border bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>{playedAt ? playedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Unknown time"}</span>
                        <span>{formatNumber(play.listeners)} listeners</span>
                      </div>
                      <div className="text-sm font-semibold">{play.songs?.title ?? "Unknown song"}</div>
                      <div className="text-xs text-muted-foreground">{play.songs?.bands?.name ?? "Unknown band"} • {play.songs?.genre ?? "Unknown genre"}</div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  We haven’t tracked any spins yet. Once this station cues up tracks, you’ll see them here instantly.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListMusic className="h-5 w-5" /> Featured playlists
              </CardTitle>
              <CardDescription>Active rotations curated by the station’s programming team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {playlistsLoading ? (
                <div className="text-sm text-muted-foreground">Loading playlists...</div>
              ) : playlists.length ? (
                playlists.map((playlist) => (
                  <div key={playlist.id} className="rounded-lg border p-4 text-sm">
                    <div className="font-semibold">{playlist.songs?.title ?? "Unknown song"}</div>
                    <div className="text-xs text-muted-foreground">
                      {playlist.songs?.bands?.name ?? "Unknown band"} • {playlist.radio_shows?.show_name ?? "Unassigned show"}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Week of {formatDate(playlist.week_start_date)}</span>
                      <span>{playlist.times_played ?? 0} spins</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No playlists have been published yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Adjust the filters or select a card above to view station details.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5" /> Future enhancements
          </CardTitle>
          <CardDescription>
            Ten ambitious ideas to evolve the radio experience even further for artists, DJs, and fans.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {enhancementIdeas.map((idea) => (
            <div key={idea} className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              {idea}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
