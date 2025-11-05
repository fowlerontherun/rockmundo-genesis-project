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
import {
  BarChart3,
  Lightbulb,
  ListMusic,
  MapPin,
  Music,
  Radio as RadioIcon,
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

type RadioPlaylistRecord = {
  id: string;
  week_start_date: string | null;
  times_played: number | null;
  added_at: string | null;
  songs?: { title: string | null; genre: string | null; bands?: { name: string | null } | null } | null;
  radio_shows?: { id: string; show_name: string | null } | null;
};

type RadioPlayRecord = {
  song_id: string;
  listeners: number;
  played_at: string;
  songs?: { title: string | null; genre: string | null; bands?: { name: string | null } | null } | null;
};

type NowPlayingRecord = {
  id: string;
  played_at: string | null;
  listeners: number;
  songs?: {
    id: string;
    title: string | null;
    genre: string | null;
    bands?: { id: string; name: string | null } | null;
  } | null;
  radio_shows?: { id: string; show_name: string | null } | null;
};

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat().format(value ?? 0);

const formatLocation = (station: RadioStationRecord) => {
  const city = station.cities?.name;
  const country = station.cities?.country ?? station.country;

  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  return "Unknown location";
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "–";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export default function Radio() {
  const [typeFilter, setTypeFilter] = useState<"all" | "national" | "local">("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const { data: stations = [], isLoading: stationsLoading } = useQuery({
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
    return stations.filter((station) => {
      if (typeFilter !== "all" && station.station_type !== typeFilter) return false;

      if (genreFilter !== "all") {
        const genres = station.accepted_genres ?? [];
        if (!genres.includes(genreFilter)) return false;
      }

      if (locationFilter !== "all") {
        if (formatLocation(station) !== locationFilter) return false;
      }

      return true;
    });
  }, [stations, typeFilter, genreFilter, locationFilter]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Radio Network</h1>
        <p className="text-muted-foreground">
          Discover every station in the world of Rockmundo, browse their programming, and monitor
          the songs captivating listeners right now.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RadioIcon className="h-5 w-5" /> Station Filters
          </CardTitle>
          <CardDescription>
            Narrow the catalogue by format, genre, or location to find the perfect station for your next spin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {["all", "national", "local"].map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                onClick={() => setTypeFilter(type as typeof typeFilter)}
              >
                {type === "all" ? "All Stations" : `${type.charAt(0).toUpperCase()}${type.slice(1)} Stations`}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Filter by genre</div>
              <Select value={genreFilter} onValueChange={setGenreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genres</SelectItem>
                  {genreOptions.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Filter by location</div>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stationsLoading ? (
          <Card>
            <CardContent className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
              Loading stations...
            </CardContent>
          </Card>
        ) : filteredStations.length ? (
          filteredStations.map((station) => (
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
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
              No stations match the selected filters.
            </CardContent>
          </Card>
        )}
      </div>

      {selectedStation ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Music className="h-5 w-5" /> Now playing & overview
              </CardTitle>
              <CardDescription>
                Snapshot of the currently spinning track and high-level stats for the station.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <div className="font-semibold">Current track</div>
                {nowPlaying ? (
                  <>
                    <div>{nowPlaying.songs?.title ?? "Unknown song"}</div>
                    <div className="text-muted-foreground">
                      {nowPlaying.songs?.bands?.name ?? "Unknown band"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {nowPlaying.radio_shows?.show_name ? `During ${nowPlaying.radio_shows.show_name}` : "Unscheduled spin"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {nowPlaying.played_at ? `Last updated ${formatDate(nowPlaying.played_at)}` : "Play time unavailable"}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">No live play data available.</div>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Listener base</div>
                  <div className="font-semibold">{formatNumber(selectedStation.listener_base)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Quality tier</div>
                  <div className="font-semibold">Level {selectedStation.quality_level}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Station type</div>
                  <div className="font-semibold capitalize">{selectedStation.station_type}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-semibold">{formatLocation(selectedStation)}</div>
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
