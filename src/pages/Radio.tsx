import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";
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
  Users,
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

type RecordedSongRecord = {
  id: string;
  title: string;
  genre: string | null;
  quality_score: number | null;
  band_id: string | null;
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
  const [selectedShow, setSelectedShow] = useState<string>("");
  const [filterType, setFilterType] = useState<'all' | 'national' | 'local'>('all');
  const [metricsRange, setMetricsRange] = useState<7 | 14 | 30>(14);

  const getErrorMessage = (error: unknown, fallback = 'An unexpected error occurred.') =>
    error instanceof Error ? error.message : fallback;

  const { data: profile } = useQuery({
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

  const {
    data: stations,
    isLoading: stationsLoading,
    isError: stationsError,
    error: stationsErrorData,
  } = useQuery<RadioStationRecord[]>({
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

  const {
    data: shows,
    isLoading: showsLoading,
    isError: showsError,
    error: showsErrorData,
  } = useQuery<RadioShowRecord[]>({
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

  useEffect(() => {
    if (!shows || shows.length === 0) {
      setSelectedShow("");
      return;
    }

    setSelectedShow((current) => {
      const isValidSelection = shows.some((show) => show.id === current);
      return isValidSelection ? current : shows[0].id;
    });
  }, [shows]);

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

  const {
    data: bandRadioEarnings,
    isLoading: bandRadioEarningsLoading,
    isError: bandRadioEarningsError,
    error: bandRadioEarningsErrorData,
  } = useQuery<BandRadioEarning[]>({
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
    queryKey: ['station-play-summary', selectedStation, metricsRange],
    queryFn: async () => {
      if (!selectedStation) return null;

      const { data, error } = await supabase.rpc('get_radio_station_play_summary' as any, {
        p_station_id: selectedStation,
        p_days: metricsRange,
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
    queryKey: ['station-play-timeline', selectedStation, metricsRange],
    queryFn: async () => {
      if (!selectedStation) return [];

      const { data, error } = await supabase.rpc('get_radio_station_play_timeline' as any, {
        p_station_id: selectedStation,
        p_days: metricsRange,
      });

      if (error) throw error;
      return (data as StationPlayTimelineEntry[]) || [];
    },
    enabled: !!selectedStation,
  });

  const timelineData = useMemo(() => {
    if (!selectedStation) return [];

    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = metricsRange - 1; i >= 0; i--) {
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
  }, [stationPlayTimeline, selectedStation, metricsRange]);

  const timelineChartConfig = useMemo<ChartConfig>(
    () => ({
      spins: {
        label: 'Spins',
        color: 'hsl(var(--chart-1))',
      },
      listeners: {
        label: 'Listeners',
        color: 'hsl(var(--chart-2))',
      },
      revenue: {
        label: 'Revenue',
        color: 'hsl(var(--chart-3))',
      },
    }),
    []
  );

  const timelineSummaryStats = useMemo(() => {
    if (!timelineData.length) {
      return { avgSpins: 0, avgListeners: 0, avgRevenue: 0 };
    }

    const totals = timelineData.reduce(
      (acc, day) => ({
        spins: acc.spins + day.spins,
        listeners: acc.listeners + day.listeners,
        revenue: acc.revenue + day.revenue,
      }),
      { spins: 0, listeners: 0, revenue: 0 }
    );

    return {
      avgSpins: totals.spins / timelineData.length,
      avgListeners: totals.listeners / timelineData.length,
      avgRevenue: totals.revenue / timelineData.length,
    };
  }, [timelineData]);

  const timelineHasData = useMemo(
    () =>
      timelineData.some(
        (entry) => entry.spins > 0 || entry.listeners > 0 || entry.revenue > 0
      ),
    [timelineData]
  );

  const formatTimelineDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const timelineTooltipFormatter = (value: number | string, name: string) => {
    const numericValue = typeof value === 'number' ? value : Number(value ?? 0);

    switch (name) {
      case 'spins':
        return [numericValue.toLocaleString(), 'Spins'];
      case 'listeners':
        return [numericValue.toLocaleString(), 'Listeners'];
      case 'revenue':
        return [currencyFormatter.format(numericValue), 'Revenue'];
      default:
        return [numericValue.toLocaleString(), name];
    }
  };

  const { data: recordedSongs } = useQuery<RecordedSongRecord[]>({
    queryKey: ['recorded-songs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'recorded')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as RecordedSongRecord[]) || [];
    },
    enabled: !!user?.id,
  });

  const selectedSongData = useMemo(() => {
    if (!selectedSong) return null;
    return recordedSongs?.find((song) => song.id === selectedSong) ?? null;
  }, [recordedSongs, selectedSong]);

  const primaryBand = useMemo(() => {
    const bandsData = (profile as any)?.bands;
    if (!bandsData) return null;
    return Array.isArray(bandsData) ? bandsData[0] : bandsData;
  }, [profile]);

  const bandFame = Number(primaryBand?.fame ?? 0);
  const hasBand = Boolean(primaryBand?.id);

  const stationAcceptedGenres = useMemo<string[]>(() => {
    return activeStation?.accepted_genres ?? [];
  }, [activeStation]);

  const normalizedAcceptedGenres = useMemo(
    () => stationAcceptedGenres.map((genre) => genre.toLowerCase()),
    [stationAcceptedGenres],
  );

  const songGenre = (selectedSongData?.genre ?? '').toLowerCase();

  const stationRequirements = useMemo<{ quality: number; fame: number }>(() => {
    if (!activeStation) {
      return { quality: 0, fame: 0 };
    }

    const baseQuality = 400 + (activeStation.quality_level - 1) * 200;
    const listenerQualityAdjustment = Math.min(
      400,
      Math.round(((activeStation.listener_base ?? 0) / 50000) * 100),
    );
    const qualityRequirement = Math.min(2000, baseQuality + listenerQualityAdjustment);

    const fameBase = Math.max(0, (activeStation.quality_level - 1) * 250);
    const fameListenerAdjustment = Math.round(((activeStation.listener_base ?? 0) / 100000) * 100);
    const fameRequirement = Math.max(0, fameBase + fameListenerAdjustment);

    return {
      quality: Math.round(qualityRequirement),
      fame: Math.round(fameRequirement),
    };
  }, [activeStation]);

  const songQuality = Number(selectedSongData?.quality_score ?? 0);

  const genreMatches = useMemo(() => {
    if (!selectedSong) return true;
    if (normalizedAcceptedGenres.length === 0) return true;
    if (!songGenre) return false;
    return normalizedAcceptedGenres.includes(songGenre);
  }, [normalizedAcceptedGenres, selectedSong, songGenre]);

  const meetsQualityRequirement = useMemo(() => {
    if (!selectedSong) return true;
    if (!stationRequirements.quality) return true;
    return songQuality >= stationRequirements.quality;
  }, [selectedSong, stationRequirements.quality, songQuality]);

  const meetsFameRequirement = useMemo(() => {
    if (!selectedSong) return true;
    if (!stationRequirements.fame) return true;
    return bandFame >= stationRequirements.fame;
  }, [bandFame, selectedSong, stationRequirements.fame]);

  const canSubmit = Boolean(
    selectedStation &&
    selectedSong &&
    genreMatches &&
    meetsQualityRequirement &&
    meetsFameRequirement,
  );

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

  const {
    data: topSongs,
    isLoading: topSongsLoading,
    isError: topSongsError,
    error: topSongsErrorData,
  } = useQuery({
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

  useEffect(() => {
    const errors = [
      {
        hasError: stationsError,
        error: stationsErrorData,
        title: 'Unable to load radio stations',
      },
      {
        hasError: showsError,
        error: showsErrorData,
        title: 'Unable to load station shows',
      },
      {
        hasError: nowPlayingError,
        error: nowPlayingErrorData,
        title: 'Unable to load now playing details',
      },
      {
        hasError: bandRadioEarningsError,
        error: bandRadioEarningsErrorData,
        title: 'Unable to load band radio earnings',
      },
      {
        hasError: stationPlaySummaryError,
        error: stationPlaySummaryErrorData,
        title: 'Unable to load station summary',
      },
      {
        hasError: stationPlayTimelineError,
        error: stationPlayTimelineErrorData,
        title: 'Unable to load station timeline',
      },
      {
        hasError: recordedSongsError,
        error: recordedSongsErrorData,
        title: 'Unable to load recorded songs',
      },
      {
        hasError: mySubmissionsError,
        error: mySubmissionsErrorData,
        title: 'Unable to load your submissions',
      },
      {
        hasError: topSongsError,
        error: topSongsErrorData,
        title: 'Unable to load trending songs',
      },
    ];

    errors.forEach(({ hasError, error, title }) => {
      if (hasError) {
        toast.error(title, {
          description: getErrorMessage(error),
        });
      }
    });
  }, [
    stationsError,
    stationsErrorData,
    showsError,
    showsErrorData,
    nowPlayingError,
    nowPlayingErrorData,
    bandRadioEarningsError,
    bandRadioEarningsErrorData,
    stationPlaySummaryError,
    stationPlaySummaryErrorData,
    stationPlayTimelineError,
    stationPlayTimelineErrorData,
    recordedSongsError,
    recordedSongsErrorData,
    mySubmissionsError,
    mySubmissionsErrorData,
    topSongsError,
    topSongsErrorData,
  ]);

  const submitSong = useMutation({
    mutationFn: async () => {
      if (!selectedStation || !selectedSong) {
        throw new Error('Please select a station and song');
      }

      if (!selectedSongData) {
        throw new Error('Please select a song that meets the station requirements');
      }

      if (normalizedAcceptedGenres.length > 0) {
        const normalizedGenre = (selectedSongData.genre ?? '').toLowerCase();
        if (!normalizedGenre || !normalizedAcceptedGenres.includes(normalizedGenre)) {
          const acceptedList = stationAcceptedGenres.join(', ');
          throw new Error(
            acceptedList
              ? `This station is currently accepting: ${acceptedList}.`
              : 'This station has restricted genre requirements right now.',
          );
        }
      }

      if (stationRequirements.quality && songQuality < stationRequirements.quality) {
        throw new Error(
          `This station requires a song quality of ${stationRequirements.quality.toLocaleString()} or higher.`,
        );
      }

      if (stationRequirements.fame && bandFame < stationRequirements.fame) {
        const fameRequirementMessage = hasBand
          ? `Your band needs at least ${stationRequirements.fame.toLocaleString()} fame to submit here.`
          : 'Join or create a band to build the fame required for this station.';
        throw new Error(fameRequirementMessage);
      }

      // Check if already submitted this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartDate = weekStart.toISOString().split('T')[0];

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

      if (error) throw error;

      const { data: stationData } = await supabase
        .from('radio_stations')
        .select('id, name, listener_base')
        .eq('id', selectedStation)
        .single();

      await supabase
        .from('radio_submissions')
        .update({
          status: 'accepted',
          reviewed_at: nowIso,
          rejection_reason: null,
        })
        .eq('id', data.id);

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
          const listeners = Math.max(
            100,
            Math.round((stationData.listener_base || 0) * (0.55 + Math.random() * 0.35))
          );
          const hypeGain = Math.max(1, Math.round(listeners * 0.002));
          const streamsBoost = Math.max(10, Math.round(listeners * 0.6));
          const radioRevenue = Math.max(5, Math.round(listeners * 0.015));

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

        throw error;
      }

      if (!submission) {
        throw new Error('Failed to create radio submission.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-radio-submissions'] });
      toast.success('Submission received! The station team will review it soon.');
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

  const submitDisabled = submitSong.isPending || !canSubmit;

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
                      onClick={() => {
                        setSelectedStation(station.id);
                        setSelectedShow('');
                      }}
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
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-2/3" />
                            <div className="space-y-2 pt-1">
                              <Skeleton className="h-3 w-24" />
                              <div className="flex flex-wrap gap-1">
                                {Array.from({ length: 3 }).map((_, i) => (
                                  <Skeleton key={i} className="h-5 w-16" />
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    : stations?.map((station) => (
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
                                <p className="mb-1 text-xs text-muted-foreground">Accepts:</p>
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

                {!stationsLoading && !stationsError && (stations?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No stations found for this filter.</p>
                )}

                {selectedStation && (
                  <div className="space-y-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Station Performance</p>
                        <p className="text-xs text-muted-foreground">
                          Aggregated over the last {metricsRange} days
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {([7, 14, 30] as const).map((range) => (
                          <Button
                            key={range}
                            size="sm"
                            variant={metricsRange === range ? "default" : "outline"}
                            onClick={() => setMetricsRange(range)}
                          >
                            {range}D
                          </Button>
                        ))}
                      </div>
                    </div>

                    {stationPlaySummary && (
                      <div className="grid gap-3 md:grid-cols-3">
                        <Card className="border-primary/30 bg-background/80 shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Total Spins
                            </CardTitle>
                            <RadioIcon className="h-4 w-4 text-primary" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-semibold">
                              {stationPlaySummary.total_spins.toLocaleString()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Across {metricsRange} day window
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-primary/30 bg-background/80 shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Listeners Reached
                            </CardTitle>
                            <Users className="h-4 w-4 text-primary" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-semibold">
                              {stationPlaySummary.total_listeners.toLocaleString()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Unique listeners during this period
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border-primary/30 bg-background/80 shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Estimated Payouts
                            </CardTitle>
                            <DollarSign className="h-4 w-4 text-primary" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-semibold">
                              {currencyFormatter.format(stationPlaySummary.total_revenue || 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">Projected from reported spins</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {stationPlaySummary && (
                      <div className="rounded-md border border-primary/20 bg-background/60 p-3 text-xs text-muted-foreground">
                        Streams boosted over this window:
                        <span className="ml-1 font-semibold text-foreground">
                          {stationPlaySummary.total_streams.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      !stationPlaySummaryError && (
                        <p className="text-xs text-muted-foreground">
                          Summary data will appear after the station records more plays.
                        </p>
                      )
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

                    {nowPlayingError && (
                      <Alert variant="destructive">
                        <AlertTitle>Unable to load now playing</AlertTitle>
                        <AlertDescription>
                          {getErrorMessage(nowPlayingErrorData)}
                        </AlertDescription>
                      </Alert>
                    )}

                    {nowPlayingLoading ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={`now-playing-${index}`} className="h-10 w-full" />
                          ))}
                        </div>
                      </div>
                    ) : nowPlaying ? (
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
                      !nowPlayingError && (
                        <div className="rounded-md border border-dashed border-primary/20 bg-background/80 p-4 text-sm text-muted-foreground">
                          No spins recorded yet today. Submitting a song will immediately trigger airplay for this station.
                        </div>
                      )
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
                      {bandRadioEarningsLoading ? (
                        <div className="space-y-2 text-sm">
                          {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={`revenue-skeleton-${index}`} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : bandRadioEarningsError ? (
                        <Alert variant="destructive">
                          <AlertTitle>Unable to load earnings</AlertTitle>
                          <AlertDescription>
                            {getErrorMessage(bandRadioEarningsErrorData)}
                          </AlertDescription>
                        </Alert>
                      ) : aggregatedBandRevenue.length > 0 ? (
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
                          {metricsRange}-Day Performance Timeline
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Spins, listeners & revenue trends
                        </span>
                      </div>
                      {timelineHasData ? (
                        <>
                          <div className="mt-4 h-64">
                            <ChartContainer config={timelineChartConfig} className="h-full w-full">
                              <AreaChart data={timelineData} margin={{ left: 12, right: 12, top: 12, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="radio-spins" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-spins)" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="var(--color-spins)" stopOpacity={0.05} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                  dataKey="date"
                                  tickLine={false}
                                  axisLine={false}
                                  tickMargin={8}
                                  tickFormatter={formatTimelineDate}
                                />
                                <YAxis
                                  yAxisId="left"
                                  tickLine={false}
                                  axisLine={false}
                                  width={60}
                                  tickFormatter={(value) => Number(value).toLocaleString()}
                                />
                                <YAxis
                                  yAxisId="right"
                                  orientation="right"
                                  tickLine={false}
                                  axisLine={false}
                                  width={70}
                                  tickFormatter={(value) => currencyFormatter.format(Number(value))}
                                />
                                <ChartTooltip
                                  cursor={{ strokeDasharray: '4 4' }}
                                  content={
                                    <ChartTooltipContent
                                      labelFormatter={formatTimelineDate}
                                      formatter={timelineTooltipFormatter}
                                    />
                                  }
                                />
                                <Area
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="spins"
                                  stroke="var(--color-spins)"
                                  fill="url(#radio-spins)"
                                  strokeWidth={2}
                                  activeDot={{ r: 4 }}
                                />
                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="listeners"
                                  stroke="var(--color-listeners)"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="revenue"
                                  stroke="var(--color-revenue)"
                                  strokeWidth={2}
                                  strokeDasharray="6 4"
                                  dot={false}
                                />
                              </AreaChart>
                            </ChartContainer>
                          </div>
                          <div className="grid gap-2 pt-3 text-xs text-muted-foreground sm:grid-cols-3">
                            <div className="rounded-md border border-border/60 bg-background/80 p-3">
                              <p className="font-medium text-foreground">
                                {Math.round(timelineSummaryStats.avgSpins).toLocaleString()}
                              </p>
                              <p>Avg spins per day</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background/80 p-3">
                              <p className="font-medium text-foreground">
                                {Math.round(timelineSummaryStats.avgListeners).toLocaleString()}
                              </p>
                              <p>Avg listeners per day</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background/80 p-3">
                              <p className="font-medium text-foreground">
                                {currencyFormatter.format(timelineSummaryStats.avgRevenue || 0)}
                              </p>
                              <p>Avg revenue per day</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          No spins recorded in the last {metricsRange} days.
                        </p>
                      )}
                    </div>

                {selectedStation && shows && shows.length > 0 && (
                  <div className="pt-4">
                    <h3 className="text-lg font-semibold mb-2">Shows on this station:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {shows.map((show) => (
                        <button
                          key={show.id}
                          type="button"
                          onClick={() => setSelectedShow(show.id)}
                          aria-pressed={selectedShow === show.id}
                          className={`text-left p-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                            selectedShow === show.id
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'hover:border-primary/60 hover:bg-background/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{show.show_name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {show.time_slot}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Host: {show.host_name}</p>
                          {show.show_genres?.length ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {show.show_genres.map((genre: string) => (
                                <Badge key={genre} variant="outline" className="text-xs">
                                  {genre}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Accepts all genres
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Select Song</label>
                  {recordedSongsError && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertTitle>Unable to load recorded songs</AlertTitle>
                      <AlertDescription>
                        {getErrorMessage(recordedSongsErrorData)}
                      </AlertDescription>
                    </Alert>
                  )}
                  {recordedSongsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={selectedSong}
                      onValueChange={setSelectedSong}
                      disabled={recordedSongsError || !recordedSongs?.length}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            recordedSongsError
                              ? 'Unable to load songs'
                              : recordedSongs?.length
                              ? 'Choose a recorded song'
                              : 'No recorded songs available'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {recordedSongs?.map((song) => (
                          <SelectItem key={song.id} value={song.id}>
                            {song.title} ({song.genre}) - Quality: {song.quality_score}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {activeStation && (
                  <div className="rounded-md border border-border/60 bg-background/80 p-3 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Station Requirements</span>
                      <Badge variant="outline">Level {activeStation.quality_level}</Badge>
                    </div>
                    {stationAcceptedGenres.length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">Accepted genres</p>
                        <div className="flex flex-wrap gap-1">
                          {stationAcceptedGenres.map((genre) => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">This station accepts all genres.</p>
                    )}
                    {selectedSong && (
                      <div className="space-y-2">
                        <div
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs sm:text-sm ${
                            genreMatches
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'border-destructive/40 bg-destructive/10 text-destructive'
                          }`}
                        >
                          <span>Genre match</span>
                          <span className="font-semibold">
                            {selectedSongData?.genre ?? 'None'}
                          </span>
                        </div>
                        {stationRequirements.quality > 0 && (
                          <div
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs sm:text-sm ${
                              meetsQualityRequirement
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'border-destructive/40 bg-destructive/10 text-destructive'
                            }`}
                          >
                            <span>Song quality</span>
                            <span className="font-semibold">
                              {Math.round(songQuality).toLocaleString()} /{' '}
                              {stationRequirements.quality.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {stationRequirements.fame > 0 && (
                          <div
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs sm:text-sm ${
                              meetsFameRequirement
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'border-destructive/40 bg-destructive/10 text-destructive'
                            }`}
                          >
                            <span>Band fame</span>
                            <span className="font-semibold">
                              {Math.round(bandFame).toLocaleString()} /{' '}
                              {stationRequirements.fame.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedSong && activeStation && (
                  <div className="space-y-2">
                    {!genreMatches && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {stationAcceptedGenres.length > 0
                            ? `This station prefers ${stationAcceptedGenres.join(', ')}. Pick a song in one of those genres to submit.`
                            : 'Please assign a genre to this song before submitting.'}
                        </AlertDescription>
                      </Alert>
                    )}
                    {!meetsQualityRequirement && stationRequirements.quality > 0 && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {`This station requires a song quality of ${stationRequirements.quality.toLocaleString()} or higher. Your track is currently ${Math.round(songQuality).toLocaleString()}.`}
                        </AlertDescription>
                      </Alert>
                    )}
                    {!meetsFameRequirement && stationRequirements.fame > 0 && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {hasBand
                            ? `Your band has ${Math.round(bandFame).toLocaleString()} fame. Earn ${Math.max(0, stationRequirements.fame - bandFame).toLocaleString()} more to unlock this station.`
                            : 'Join or create a band to build the fame required for this station.'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (!submitDisabled) {
                      submitSong.mutate();
                    }
                  }}
                  disabled={submitDisabled}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit to Radio Station
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            {mySubmissionsError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load your submissions</AlertTitle>
                <AlertDescription>
                  {getErrorMessage(mySubmissionsErrorData)}
                </AlertDescription>
              </Alert>
            ) : mySubmissionsLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <Card key={`submission-skeleton-${index}`}>
                  <CardHeader>
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, lineIndex) => (
                        <Skeleton key={lineIndex} className="h-4 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : mySubmissions && mySubmissions.length === 0 ? (
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
                {topSongsError && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertTitle>Unable to load trending songs</AlertTitle>
                    <AlertDescription>
                      {getErrorMessage(topSongsErrorData)}
                    </AlertDescription>
                  </Alert>
                )}
                {topSongsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`top-song-skeleton-${index}`}
                        className="flex items-center gap-4 rounded-lg border p-3"
                      >
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    ))}
                  </div>
                ) : topSongs && topSongs.length > 0 ? (
                  <div className="space-y-3">
                    {topSongs.map((song, index) => (
                      <div key={song.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
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
                ) : (
                  !topSongsError && (
                    <p className="text-sm text-muted-foreground">
                      No trending radio songs are available yet.
                    </p>
                  )
                )}
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
