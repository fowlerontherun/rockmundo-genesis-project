import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Radio as RadioIcon,
  Music,
  TrendingUp,
  Star,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  PlayCircle,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { formatUtcDate, getUtcWeekStart } from "@/utils/week";

type ProfileBand = {
  id: string;
  name: string | null;
  fame: number | null;
};

type ProfileRecord = {
  id: string;
  user_id: string;
  display_name: string | null;
  bands?: ProfileBand[] | ProfileBand | null;
};

type BandRadioEarning = {
  band_id: string;
  amount: number;
  bands?: { name?: string | null } | null;
  metadata?: Record<string, unknown> | null;
};

type NowPlayingRecord = {
  id: string;
  played_at: string | null;
  listeners: number;
  hype_gained: number | null;
  streams_boost: number | null;
  songs?: {
    id: string;
    title: string;
    genre: string;
    band_id: string | null;
    bands?: { id: string; name: string | null; fame: number | null } | null;
  } | null;
  radio_shows?: { id: string; show_name: string | null } | null;
};

type RadioStationRecord = {
  id: string;
  name: string;
  frequency: string | null;
  station_type: string;
  listener_base: number;
  quality_level: number;
  accepted_genres?: string[] | null;
  cities?: { name?: string | null; country?: string | null } | null;
  country?: string | null;
};

type RadioShowRecord = {
  id: string;
  show_name: string;
  host_name: string;
  show_genres: string[] | null;
  time_slot: string;
  listener_multiplier: number | null;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const calculateRadioPlayMetrics = ({
  listenerBase,
  listenerMultiplier,
  songHype,
  totalRadioPlays,
}: {
  listenerBase: number;
  listenerMultiplier: number;
  songHype: number;
  totalRadioPlays: number;
}) => {
  const hypeFactor = 0.75 + clamp(songHype / 1200, 0, 0.9);
  const fatiguePenalty = 1 - clamp(totalRadioPlays / 80, 0, 0.35);
  const effectiveMultiplier = Math.max(listenerMultiplier, 0.1);
  const effectiveListenerBase = Math.max(listenerBase, 0);

  const listeners = Math.max(
    100,
    Math.round(effectiveListenerBase * effectiveMultiplier * hypeFactor * fatiguePenalty)
  );

  const hypeGain = Math.max(1, Math.round(listeners * 0.002));
  const streamsBoost = Math.max(10, Math.round(listeners * 0.6));
  const radioRevenue = Math.max(5, Math.round(listeners * 0.015));

  return { listeners, hypeGain, streamsBoost, radioRevenue };
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
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setUser(data.user);
      }
    });
  });
  const [selectedStation, setSelectedStation] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("radio-selected-station") ?? "";
    }
    return "";
  });
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [filterType, setFilterType] = useState<'all' | 'national' | 'local'>('all');

  // Load the user's profile so we can surface their band leadership context and
  // gate radio submissions when they are not managing a band. This keeps the
  // radio flow aligned with the simulation's requirement that only band leaders
  // can pitch songs to stations.
  const { data: profile, isLoading: isProfileLoading } = useQuery<ProfileRecord | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, bands!bands_leader_id_fkey(id, name, fame)')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return submission;
    },
    enabled: !!user?.id,
  });

  const profileBands = useMemo<ProfileBand[]>(() => {
    if (!profile?.bands) return [];
    return Array.isArray(profile.bands) ? profile.bands : [profile.bands];
  }, [profile]);

  const primaryBand = profileBands[0] ?? null;
  const canSubmitSongs = profileBands.length > 0;

  const { data: stations } = useQuery<RadioStationRecord[]>({
    queryKey: ['radio-stations', filterType],
    queryFn: async () => {
      let query = supabase
        .from('radio_stations')
        .select('*, cities(name, country)')
        .eq('is_active', true)
        .order('quality_level', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('station_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as RadioStationRecord[]) || [];
    },
  });

  useEffect(() => {
    if (!stations || stations.length === 0) return;

    const stationExists = stations.some((station) => station.id === selectedStation);

    if (selectedStation && !stationExists) {
      setSelectedStation(stations[0].id);
      return;
    }

    if (!selectedStation) {
      setSelectedStation(stations[0].id);
    }
  }, [stations, selectedStation]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (selectedStation) {
      localStorage.setItem("radio-selected-station", selectedStation);
    } else {
      localStorage.removeItem("radio-selected-station");
    }
  }, [selectedStation]);

  const activeStation = useMemo(() => {
    return stations?.find((station) => station.id === selectedStation);
  }, [stations, selectedStation]);

  const { data: shows } = useQuery<RadioShowRecord[]>({
    queryKey: ['radio-shows', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const { data, error } = await supabase
        .from('radio_shows')
        .select('*')
        .eq('station_id', selectedStation)
        .eq('is_active', true)
        .order('time_slot');
      if (error) throw error;
      return (data as RadioShowRecord[]) || [];
    },
    enabled: !!selectedStation,
  });

  const { data: nowPlaying } = useQuery<NowPlayingRecord | null>({
    queryKey: ['station-now-playing', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return null;
      const { data, error } = await supabase
        .from('radio_plays')
        .select(`
          id,
          played_at,
          listeners,
          hype_gained,
          streams_boost,
          songs (
            id,
            title,
            genre,
            band_id,
            bands ( id, name, fame )
          ),
          radio_shows ( id, show_name )
        `)
        .eq('station_id', selectedStation)
        .order('played_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as NowPlayingRecord | null) ?? null;
    },
    enabled: !!selectedStation,
  });

  const { data: bandRadioEarnings } = useQuery<BandRadioEarning[]>({
    queryKey: ['band-radio-earnings', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('band_earnings')
        .select('amount, created_at, band_id, bands(name), metadata')
        .eq('source', 'radio_play')
        .gte('created_at', startOfDay.toISOString())
        .contains('metadata', { station_id: selectedStation })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as BandRadioEarning[]) || [];
    },
    enabled: !!selectedStation,
  });

  const aggregatedBandRevenue = useMemo(() => {
    if (!bandRadioEarnings) return [];

    const revenueMap = new Map<string, { name: string; total: number; plays: number }>();

    for (const earning of bandRadioEarnings) {
      const key = earning.band_id;
      const entry = revenueMap.get(key) || {
        name: earning.bands?.name || 'Unknown Band',
        total: 0,
        plays: 0,
      };

      entry.total += earning.amount;
      entry.plays += 1;
      revenueMap.set(key, entry);
    }

    return Array.from(revenueMap.entries()).map(([bandId, info]) => ({
      bandId,
      ...info,
    }));
  }, [bandRadioEarnings]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    []
  );

  const dailyRevenueTotal = useMemo(
    () => aggregatedBandRevenue.reduce((sum, band) => sum + band.total, 0),
    [aggregatedBandRevenue]
  );

  const { data: stationPlaySummary } = useQuery<StationPlaySummary | null>({
    queryKey: ['station-play-summary', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return null;

      const { data, error } = await supabase.rpc('get_radio_station_play_summary' as any, {
        p_station_id: selectedStation,
        p_days: 14,
      });

      if (error) throw error;

      const results = Array.isArray(data) ? data : [];
      const summary = results.length > 0 ? results[0] : null;

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

      const { data, error } = await supabase.rpc('get_radio_station_play_timeline' as any, {
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
      return submission;
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
      return submission;
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

      const { data: weekCheckData, error: weekCheckError } = await supabase.rpc('check_radio_submission_week', {
        p_station_id: selectedStation,
        p_song_id: selectedSong,
      });

      if (weekCheckError) {
        console.error('Failed to verify radio submission window', weekCheckError);
        throw new Error('Unable to verify submission window. Please try again.');
      }

      const weekCheck = Array.isArray(weekCheckData) ? weekCheckData[0] : weekCheckData;
      const weekStartDate = weekCheck?.week_start_date ?? formatUtcDate(getUtcWeekStart(new Date(), 1));

      if (existing) {
        throw new Error(
          "You've already submitted this track to this station this week. Try another station or wait until next week."
        );
      }

      const now = new Date();
      const nowIso = now.toISOString();

      let submission: any = null;
      try {
        const { data, error } = await supabase
          .from('radio_submissions')
          .insert({
            song_id: selectedSong,
            user_id: user?.id,
            station_id: selectedStation,
            week_submitted: weekStartDate,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        submission = data;
      } catch (error: any) {
        if (error?.code === '23505' || error?.message?.includes('one_submission_per_week')) {
          throw new Error(
            "You've already submitted this track to this station this week. Try another station or wait until next week."
          );
        }

        throw error;
      }

      if (!submission) {
        throw new Error('Failed to create radio submission.');
      }

      const { data: selectedSongData } = await supabase
        .from('songs')
        .select('id, title, hype, band_id, total_radio_plays, streams, revenue')
        .eq('id', selectedSong)
        .single();

      const { data: stationData } = await supabase
        .from('radio_stations')
        .select('id, name, listener_base')
        .eq('id', selectedStation)
        .single();

      const { data: show } = await supabase
        .from('radio_shows')
        .select('id, show_name, listener_multiplier')
        .eq('station_id', selectedStation)
        .eq('is_active', true)
        .order('time_slot', { ascending: true })
        .limit(1)
        .maybeSingle();

      await supabase
        .from('radio_submissions')
        .update({
          status: 'accepted',
          reviewed_at: nowIso,
          rejection_reason: null,
        })
        .eq('id', submission.id);

      if (selectedSongData && stationData && show) {
        let playlistId: string | null = null;

        const { data: existingPlaylist } = await supabase
          .from('radio_playlists')
          .select('*')
          .eq('show_id', show.id)
          .eq('song_id', selectedSong)
          .eq('week_start_date', weekStartDate)
          .maybeSingle();

        if (existingPlaylist) {
          await supabase
            .from('radio_playlists')
            .update({
              times_played: (existingPlaylist.times_played || 0) + 1,
              added_at: nowIso,
              is_active: true,
            })
            .eq('id', existingPlaylist.id);

          playlistId = existingPlaylist.id;
        } else {
          const { data: newPlaylist } = await supabase
            .from('radio_playlists')
            .insert({
              show_id: show.id,
              song_id: selectedSong,
              week_start_date: weekStartDate,
              added_at: nowIso,
              is_active: true,
              times_played: 1,
            })
            .select()
            .single();

          playlistId = newPlaylist?.id ?? null;
        }

        if (playlistId) {
          const { listeners, hypeGain, streamsBoost, radioRevenue } = calculateRadioPlayMetrics({
            listenerBase: stationData.listener_base || 0,
            listenerMultiplier: Number(show.listener_multiplier ?? 1),
            songHype: Number(selectedSongData.hype || 0),
            totalRadioPlays: Number(selectedSongData.total_radio_plays || 0),
          });

          const { data: playRecord } = await supabase
            .from('radio_plays')
            .insert({
              playlist_id: playlistId,
              show_id: show.id,
              song_id: selectedSong,
              station_id: selectedStation,
              listeners,
              played_at: nowIso,
              hype_gained: hypeGain,
              streams_boost: streamsBoost,
              sales_boost: radioRevenue,
            })
            .select()
            .single();

          await supabase
            .from('songs')
            .update({
              hype: (selectedSongData.hype || 0) + hypeGain,
              total_radio_plays: (selectedSongData.total_radio_plays || 0) + 1,
              last_radio_play: nowIso,
              streams: (selectedSongData.streams || 0) + streamsBoost,
              revenue: (selectedSongData.revenue || 0) + radioRevenue,
            })
            .eq('id', selectedSong);

          if (selectedSongData.band_id) {
            const { data: band } = await supabase
              .from('bands')
              .select('fame')
              .eq('id', selectedSongData.band_id)
              .single();

            if (band) {
              const fameGain = 0.1;

              await supabase
                .from('bands')
                .update({ fame: (band.fame || 0) + fameGain })
                .eq('id', selectedSongData.band_id);

              await supabase.from('band_fame_events').insert({
                band_id: selectedSongData.band_id,
                fame_gained: fameGain,
                event_type: 'radio_play',
                event_data: {
                  station_id: selectedStation,
                  station_name: stationData.name,
                  play_id: playRecord?.id,
                },
              });

              if (radioRevenue > 0) {
                await supabase.from('band_earnings').insert({
                  band_id: selectedSongData.band_id,
                  amount: radioRevenue,
                  source: 'radio_play',
                  description: `Radio play on ${stationData.name}`,
                  metadata: {
                    station_id: selectedStation,
                    station_name: stationData.name,
                    song_id: selectedSongData.id,
                    play_id: playRecord?.id,
                  },
                });
              }
            }
          }
        }
      }

      return submission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-radio-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['recorded-songs', user?.id] });
      queryClient.refetchQueries({ queryKey: ['recorded-songs', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['station-now-playing'] });
      queryClient.invalidateQueries({ queryKey: ['band-radio-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['station-play-summary'] });
      queryClient.invalidateQueries({ queryKey: ['station-play-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['top-radio-songs'] });
      toast.success('Your track is now spinning on the airwaves!');
      setSelectedSong('');
    },
    onError: (error: any) => {
      const message = error?.message ?? 'An unexpected error occurred while submitting your track.';

      if (
        typeof message === 'string' &&
        message.includes("You've already submitted this track to this station this week")
      ) {
        toast.info(
          "You've already submitted this track to this station this week. Try another station or wait until next week."
        );
        return;
      }

      toast.error(message);
    },
  });

  const getQualityColor = (level: number) => {
    if (level >= 4) return 'text-yellow-500';
    if (level >= 3) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-stage">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <RadioIcon className="h-8 w-8" />
          <div>
            <h1 className="text-4xl font-oswald">Radio Airplay</h1>
            <p className="text-muted-foreground">
              Submit your songs to radio stations and build hype with predictable reach
            </p>
          </div>
        </div>

        <Alert>
          <Music className="h-4 w-4" />
          <AlertDescription>
            Submit your recorded songs to radio stations. Higher quality stations are more selective but reach more listeners.
            Audience reach scales with each show's listener multiplier and your song's hype, so build momentum to grow your
            streams and sales with every spin.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="submit" className="w-full">
          <TabsList>
            <TabsTrigger value="submit">Submit Song</TabsTrigger>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
            <TabsTrigger value="trending">Trending on Radio</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit Song to Radio</CardTitle>
                <CardDescription>Choose a station and one of your recorded songs to submit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isProfileLoading && (
                  canSubmitSongs ? (
                    <Alert className="border-primary/30 bg-primary/5">
                      <Sparkles className="h-4 w-4" />
                      <AlertTitle>
                        Submitting as {primaryBand?.name || 'your band'}
                      </AlertTitle>
                      <AlertDescription>
                        Keep your band&apos;s reputation strong—each spin boosts fame. Current fame:{' '}
                        {Math.round((primaryBand?.fame ?? 0) * 10) / 10}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Band required for radio submissions</AlertTitle>
                      <AlertDescription>
                        Create or lead a band before pitching songs to stations. Radio deals are handled through band
                        managers.
                      </AlertDescription>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => navigate('/band')}
                      >
                        Go to Band Manager
                      </Button>
                    </Alert>
                  )
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Filter Stations</label>
                  <div className="flex gap-2">
                    <Button
                      variant={filterType === 'all' ? 'default' : 'outline'}
                      onClick={() => setFilterType('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={filterType === 'national' ? 'default' : 'outline'}
                      onClick={() => setFilterType('national')}
                    >
                      National
                    </Button>
                    <Button
                      variant={filterType === 'local' ? 'default' : 'outline'}
                      onClick={() => setFilterType('local')}
                    >
                      Local
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stations?.map((station) => (
                    <Card
                      key={station.id}
                      className={`cursor-pointer transition-colors ${
                        selectedStation === station.id ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedStation(station.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{station.name}</CardTitle>
                            <CardDescription>{station.frequency}</CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < station.quality_level
                                    ? 'fill-yellow-500 text-yellow-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <Badge variant="outline">{station.station_type}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Location:</span>
                          <span className="text-sm">
                            {station.station_type === 'national'
                              ? station.country
                              : `${station.cities?.name}, ${station.cities?.country}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Listeners:</span>
                          <span className="font-semibold">
                            {station.listener_base.toLocaleString()}
                          </span>
                        </div>
                        {station.accepted_genres?.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-1">Accepts:</p>
                            <div className="flex flex-wrap gap-1">
                              {station.accepted_genres.map((genre: string) => (
                                <Badge key={genre} variant="secondary" className="text-xs">
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
                    {nowPlaying ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xl font-semibold">{nowPlaying.songs?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {nowPlaying.songs?.genre} · {nowPlaying.songs?.bands?.name || 'Independent Artist'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Last spun {nowPlaying.played_at ? new Date(nowPlaying.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex justify-between rounded-md bg-background/60 px-3 py-2">
                            <span className="text-muted-foreground">Listeners</span>
                            <span className="font-semibold">{nowPlaying.listeners?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between rounded-md bg-background/60 px-3 py-2">
                            <span className="text-muted-foreground">Streams Boost</span>
                            <span className="font-semibold">{nowPlaying.streams_boost?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between rounded-md bg-background/60 px-3 py-2">
                            <span className="text-muted-foreground">Hype Gained</span>
                            <span className="font-semibold">{nowPlaying.hype_gained ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-primary/20 bg-background/80 p-4 text-sm text-muted-foreground">
                        No spins recorded yet today. Submitting a song will immediately trigger airplay for this station.
                      </div>
                    )}

                    <div className="space-y-3 rounded-md border border-primary/20 bg-background/70 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <DollarSign className="h-4 w-4 text-primary" />
                          Daily Band Revenue
                        </div>
                        <span className="text-sm font-semibold">
                          {currencyFormatter.format(dailyRevenueTotal || 0)}
                        </span>
                      </div>
                      {aggregatedBandRevenue.length > 0 ? (
                        <div className="space-y-2 text-sm">
                          {aggregatedBandRevenue.map((entry) => (
                            <div
                              key={entry.bandId}
                              className="flex items-center justify-between rounded-md border border-border/60 bg-background/90 px-3 py-2"
                            >
                              <div>
                                <p className="font-medium">{entry.name}</p>
                                <p className="text-xs text-muted-foreground">{entry.plays} play{entry.plays === 1 ? '' : 's'} today</p>
                              </div>
                              <span className="font-semibold">{currencyFormatter.format(entry.total)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No radio revenue logged yet today for this station. Keep submitting to earn automated payouts.
                        </p>
                      )}
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
                          <p className="text-xs text-muted-foreground">
                            Listener reach multiplier: {(Number(show.listener_multiplier ?? 1)).toFixed(2)}x
                          </p>
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
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Select Song</label>
                  <Select value={selectedSong} onValueChange={setSelectedSong}>
                    <SelectTrigger disabled={!canSubmitSongs}>
                      <SelectValue placeholder="Choose a recorded song" />
                    </SelectTrigger>
                    <SelectContent>
                      {recordedSongs?.map((song) => (
                        <SelectItem key={song.id} value={song.id}>
                          {song.title} ({song.genre}) - Quality: {song.quality_score}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => submitSong.mutate()}
                  disabled={!selectedStation || !selectedSong || submitSong.isPending || !canSubmitSongs}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit to Radio Station
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            {mySubmissions?.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No submissions yet. Submit your first song to a radio station!
                  </p>
                </CardContent>
              </Card>
            ) : (
              mySubmissions?.map((submission) => (
                <Card key={submission.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{submission.songs?.title}</CardTitle>
                        <CardDescription>{submission.radio_stations?.name}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(submission.status)}
                        <Badge
                          variant={
                            submission.status === 'accepted'
                              ? 'default'
                              : submission.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {submission.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Genre:</span>
                        <Badge variant="outline">{submission.songs?.genre}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted:</span>
                        <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
                      </div>
                      {submission.rejection_reason && (
                        <Alert variant="destructive">
                          <AlertDescription>{submission.rejection_reason}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Songs on Radio</CardTitle>
                <CardDescription>Songs with the most hype from radio airplay</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSongs?.map((song, index) => (
                    <div key={song.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        <span className="font-bold">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-muted-foreground">
                          by {song.profiles?.display_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-semibold">{song.hype || 0} hype</span>
                      </div>
                      <Badge variant="outline">{song.genre}</Badge>
                      {song.total_radio_plays > 0 && (
                        <Badge variant="secondary">{song.total_radio_plays} plays</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Future Radio Enhancements
                </CardTitle>
                <CardDescription>Opportunities to deepen the broadcast management experience</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    Build a rotation planner that balances hot, recurrent, and gold categories so accepted songs receive
                    predictable spins throughout the week.
                  </li>
                  <li>
                    Introduce genre-specific programming blocks and gate submissions based on music director preferences for
                    each show.
                  </li>
                  <li>
                    Surface historical analytics (reach, conversion, and fan growth) so bands can compare station performance
                    before spending promo budgets.
                  </li>
                  <li>
                    Allow station managers to run ad campaigns, sponsorships, and interview slots that boost revenue and fame
                    when combined with airplay.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
