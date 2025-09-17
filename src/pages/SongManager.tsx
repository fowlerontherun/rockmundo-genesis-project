import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { applyRoyaltyRecoupment } from "@/utils/contracts";
import { Music, Plus, TrendingUp, Star, Calendar, Play, Edit3, Trash2 } from "lucide-react";
import type { Database, Json } from "@/integrations/supabase/types";

interface Song {
  id: string;
  title: string;
  genre: string;
  lyrics?: string;
  quality_score: number;
  release_date?: string;
  marketing_budget?: number | null;
  chart_position?: number;
  streams: number;
  revenue: number;
  status: 'draft' | 'recorded' | 'released';
  created_at: string;
  user_id: string;
  updated_at?: string;
  co_writers: string[];
  split_percentages: number[];
}

interface StreamingAccountRecord {
  id: string;
  followers: number | null;
  platform?: {
    id?: string;
    name?: string;
    revenue_per_play?: number | null;
  } | null;
}

interface BreakdownSource {
  key: string;
  name: string;
  weight: number;
  revenuePerPlay: number;
  platformId?: string;
}

interface StreamingStatsBreakdownEntry {
  key: string;
  platformId?: string;
  name: string;
  streams: number;
  revenue: number;
  revenuePerPlay: number;
}

interface CollaboratorShare {
  id: string;
  name: string;
  percentage: number;
  streams: number;
  revenue: number;
  isOwner: boolean;
}

interface CollaboratorInputRow {
  collaborator: string;
  percentage: string;
}

interface SongGrowthRecord {
  id: string;
  song_id: string;
  user_id: string;
  streams_added: number;
  revenue_added: number;
  recorded_at: string;
  title: string;
}

interface GrowthSummaryEntry {
  songId: string;
  title: string;
  streams: number;
  revenue: number;
  shares: CollaboratorShare[];
}

interface GrowthSummary {
  totals: {
    streams: number;
    revenue: number;
  };
  bySong: GrowthSummaryEntry[];
}

const DEFAULT_REVENUE_PER_PLAY = 0.003;

const DEFAULT_STREAMING_PLATFORM_DISTRIBUTION: BreakdownSource[] = [
  { key: "spotify", name: "Spotify", weight: 45, revenuePerPlay: 0.003 },
  { key: "apple_music", name: "Apple Music", weight: 25, revenuePerPlay: 0.007 },
  { key: "youtube_music", name: "YouTube Music", weight: 20, revenuePerPlay: 0.002 },
  { key: "tidal", name: "Tidal", weight: 10, revenuePerPlay: 0.01 }
];

const slugifyPlatformKey = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || fallback;
};

const buildInitialStreamingBreakdown = (
  initialStreams: number,
  accounts: StreamingAccountRecord[] | null | undefined
): StreamingStatsBreakdownEntry[] => {
  const sources: BreakdownSource[] = (accounts && accounts.length > 0)
    ? accounts.map((account) => {
        const platformName = account.platform?.name?.trim() || "Streaming Platform";
        return {
          key: account.platform?.id || slugifyPlatformKey(platformName, account.id),
          name: platformName,
          weight: Math.max(account.followers ?? 0, 1),
          revenuePerPlay: account.platform?.revenue_per_play ?? DEFAULT_REVENUE_PER_PLAY,
          platformId: account.platform?.id ?? undefined
        };
      })
    : DEFAULT_STREAMING_PLATFORM_DISTRIBUTION.map((entry) => ({ ...entry }));

  if (sources.length === 0) {
    return [];
  }

  const totalWeight = sources.reduce((sum, entry) => sum + (entry.weight || 0), 0) || sources.length;
  let allocatedStreams = 0;

  return sources.map((entry, index) => {
    const ratio = totalWeight > 0 ? entry.weight / totalWeight : 1 / sources.length;
    const isLast = index === sources.length - 1;
    const streams = isLast
      ? Math.max(initialStreams - allocatedStreams, 0)
      : Math.max(Math.floor(initialStreams * ratio), 0);
    allocatedStreams += streams;
    const revenue = streams * entry.revenuePerPlay;

    return {
      key: entry.key || `platform_${index}`,
      platformId: entry.platformId,
      name: entry.name,
      streams,
      revenue,
      revenuePerPlay: entry.revenuePerPlay
    };
  });
};

type SongRow = Database["public"]["Tables"]["songs"]["Row"];

type SongGrowthHistoryRow = {
  id?: string | null;
  song_id?: string | null;
  user_id?: string | null;
  streams_added?: number | null;
  revenue_added?: number | null;
  recorded_at?: string | null;
  songs?: { title?: string | null } | null;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSongRecord = (record: SongRow): Song => ({
  id: record.id,
  title: record.title,
  genre: record.genre,
  lyrics: record.lyrics ?? undefined,
  quality_score: toNumber(record.quality_score, 0),
  release_date: record.release_date ?? undefined,
  chart_position: record.chart_position ?? undefined,
  streams: toNumber(record.streams, 0),
  revenue: Number(toNumber(record.revenue, 0).toFixed(2)),
  status: (record.status as Song["status"]) ?? 'draft',
  created_at: record.created_at,
  user_id: record.user_id,
  updated_at: record.updated_at ?? undefined,
  co_writers: record.co_writers ?? [],
  split_percentages: (record.split_percentages ?? []).map((value) => toNumber(value, 0)),
});

const normalizeGrowthRecord = (record: SongGrowthHistoryRow): SongGrowthRecord => {
  const fallbackId = record.id ?? `${record.song_id ?? 'song'}-${record.recorded_at ?? Date.now()}`;

  return {
    id: fallbackId,
    song_id: record.song_id ?? '',
    user_id: record.user_id ?? '',
    streams_added: toNumber(record.streams_added, 0),
    revenue_added: Number(toNumber(record.revenue_added, 0).toFixed(2)),
    recorded_at: record.recorded_at ?? new Date().toISOString(),
    title: record.songs?.title ?? 'Unknown Song',
  };
};

const calculateOwnerPercentage = (song: Song) => {
  const collaboratorTotal = song.split_percentages.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  return Math.max(0, Number((100 - collaboratorTotal).toFixed(2)));
};

const calculateCollaboratorShares = (song: Song, ownerName: string): CollaboratorShare[] => {
  const sanitizedEntries = song.co_writers
    .map((writer, index) => ({
      name: writer.trim(),
      percentage: Number.isFinite(song.split_percentages[index]) ? Number(song.split_percentages[index]) : 0,
    }))
    .filter((entry) => entry.name.length > 0 && entry.percentage > 0);

  const ownerPercentage = calculateOwnerPercentage(song);

  let allocatedStreams = 0;
  let allocatedRevenue = 0;

  const collaboratorShares = sanitizedEntries.map((entry) => {
    const percentage = Number(entry.percentage.toFixed(2));
    const streamsShare = Math.floor((song.streams * percentage) / 100);
    allocatedStreams += streamsShare;
    const revenueShare = Number(((song.revenue * percentage) / 100).toFixed(2));
    allocatedRevenue += revenueShare;

    return {
      id: `${song.id}-${entry.name}`,
      name: entry.name,
      percentage,
      streams: streamsShare,
      revenue: revenueShare,
      isOwner: false,
    } satisfies CollaboratorShare;
  });

  const ownerStreams = Math.max(song.streams - allocatedStreams, 0);
  const ownerRevenue = Math.max(Number((song.revenue - allocatedRevenue).toFixed(2)), 0);

  return [
    {
      id: `${song.id}-owner`,
      name: ownerName,
      percentage: Number(ownerPercentage.toFixed(2)),
      streams: ownerStreams,
      revenue: ownerRevenue,
      isOwner: true,
    },
    ...collaboratorShares,
  ];
};

const summarizeGrowth = (
  history: SongGrowthRecord[],
  songs: Song[],
  windowInDays: number,
  ownerName: string
): GrowthSummary => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowInDays);

  const songById = new Map(songs.map((song) => [song.id, song]));
  const summaryMap = new Map<string, GrowthSummaryEntry>();

  let totalStreams = 0;
  let totalRevenue = 0;

  history.forEach((entry) => {
    const recordedAt = new Date(entry.recorded_at);
    if (Number.isNaN(recordedAt.getTime()) || recordedAt < cutoff) {
      return;
    }

    totalStreams += entry.streams_added;
    totalRevenue += entry.revenue_added;

    const song = songById.get(entry.song_id);
    const summaryEntry = summaryMap.get(entry.song_id) ?? {
      songId: entry.song_id,
      title: song?.title ?? entry.title,
      streams: 0,
      revenue: 0,
      shares: [] as CollaboratorShare[],
    };

    summaryEntry.streams += entry.streams_added;
    summaryEntry.revenue = Number((summaryEntry.revenue + entry.revenue_added).toFixed(2));

    const incrementalSong = song
      ? { ...song, streams: entry.streams_added, revenue: entry.revenue_added }
      : null;

    const shares = incrementalSong
      ? calculateCollaboratorShares(incrementalSong, ownerName)
      : [
          {
            id: `${entry.song_id}-owner`,
            name: ownerName,
            percentage: 100,
            streams: entry.streams_added,
            revenue: Number(entry.revenue_added.toFixed(2)),
            isOwner: true,
          },
        ];

    shares.forEach((share) => {
      const existingShare = summaryEntry.shares.find(
        (currentShare) => currentShare.name === share.name && currentShare.isOwner === share.isOwner
      );

      if (existingShare) {
        existingShare.streams += share.streams;
        existingShare.revenue = Number((existingShare.revenue + share.revenue).toFixed(2));
        existingShare.percentage = share.percentage;
      } else {
        summaryEntry.shares.push({ ...share });
      }
    });

    summaryMap.set(entry.song_id, summaryEntry);
  });

  const bySong = Array.from(summaryMap.values()).map((entry) => {
    entry.shares.sort((a, b) => {
      if (a.isOwner === b.isOwner) {
        return b.revenue - a.revenue;
      }
      return a.isOwner ? -1 : 1;
    });
    return entry;
  });

  bySong.sort((a, b) => b.streams - a.streams);

  return {
    totals: {
      streams: totalStreams,
      revenue: Number(totalRevenue.toFixed(2)),
    },
    bySong,
  };
};

const SongManager = () => {
  const { user } = useAuth();
  const { profile, skills, updateProfile } = useGameData();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSong, setNewSong] = useState({
    title: '',
    genre: '',
    lyrics: ''
  });
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [releaseForm, setReleaseForm] = useState({
    releaseDate: formatDateTimeLocal(new Date()),
    marketingBudget: 0
  });
  const [growthHistory, setGrowthHistory] = useState<SongGrowthRecord[]>([]);
  const [collaboratorSong, setCollaboratorSong] = useState<Song | null>(null);
  const [isCollaboratorDialogOpen, setIsCollaboratorDialogOpen] = useState(false);
  const [collaboratorsForm, setCollaboratorsForm] = useState<CollaboratorInputRow[]>([]);

  const releasingSongsRef = useRef<Set<string>>(new Set());
  const profileRef = useRef(profile);
  const songsRef = useRef<Song[]>([]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  const POLL_INTERVAL = 30000;

  const ownerDisplayName = profile?.stage_name?.trim() || 'You';

  const genres = [
    'Rock', 'Pop', 'Hip Hop', 'Jazz', 'Blues', 'Country',
    'Electronic', 'Folk', 'Reggae', 'Metal', 'Punk', 'Alternative'
  ];

  const openCollaboratorDialog = (song: Song) => {
    setCollaboratorSong(song);
    const initialRows = song.co_writers.length
      ? song.co_writers.map((writer, index) => ({
          collaborator: writer,
          percentage: String(song.split_percentages[index] ?? 0)
        }))
      : [{ collaborator: '', percentage: '' }];
    setCollaboratorsForm(initialRows);
    setIsCollaboratorDialogOpen(true);
  };

  const closeCollaboratorDialog = () => {
    setIsCollaboratorDialogOpen(false);
    setCollaboratorSong(null);
    setCollaboratorsForm([]);
  };

  const updateCollaboratorRow = (index: number, field: keyof CollaboratorInputRow, value: string) => {
    setCollaboratorsForm((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCollaboratorRow = () => {
    setCollaboratorsForm((prev) => [...prev, { collaborator: '', percentage: '' }]);
  };

  const removeCollaboratorRow = (index: number) => {
    setCollaboratorsForm((prev) => prev.filter((_, idx) => idx !== index));
  };

  const collaboratorPreviewSong = useMemo(() => {
    if (!collaboratorSong) {
      return null;
    }

    if (collaboratorsForm.length === 0) {
      return { ...collaboratorSong, co_writers: [], split_percentages: [] };
    }

    const names = collaboratorsForm.map((row) => row.collaborator.trim());
    const percentages = collaboratorsForm.map((row) => {
      const numeric = Number(row.percentage);
      return Number.isFinite(numeric) ? numeric : 0;
    });

    return { ...collaboratorSong, co_writers: names, split_percentages: percentages };
  }, [collaboratorSong, collaboratorsForm]);

  const collaboratorPreviewShares = useMemo(
    () => (collaboratorPreviewSong ? calculateCollaboratorShares(collaboratorPreviewSong, ownerDisplayName) : []),
    [collaboratorPreviewSong, ownerDisplayName]
  );

  const collaboratorPreviewOwnerPercentage = useMemo(
    () => (collaboratorPreviewSong ? calculateOwnerPercentage(collaboratorPreviewSong) : 100),
    [collaboratorPreviewSong]
  );

  const handleSaveCollaborators = async () => {
    if (!collaboratorSong) {
      return;
    }

    const sanitizedEntries = collaboratorsForm
      .map((row) => ({
        name: row.collaborator.trim(),
        percentage: Number(row.percentage)
      }))
      .filter((entry) => entry.name.length > 0 || entry.percentage > 0);

    if (
      sanitizedEntries.some(
        (entry) => entry.name.length === 0 || Number.isNaN(entry.percentage) || entry.percentage < 0
      )
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid split',
        description: 'Provide a collaborator name and a valid percentage for each split.'
      });
      return;
    }

    const totalPercentage = sanitizedEntries.reduce((sum, entry) => sum + entry.percentage, 0);

    if (totalPercentage > 100) {
      toast({
        variant: 'destructive',
        title: 'Split exceeds 100%',
        description: 'Collaborator splits cannot exceed 100% in total.'
      });
      return;
    }

    const names = sanitizedEntries.map((entry) => entry.name);
    const percentages = sanitizedEntries.map((entry) => Number((Math.round(entry.percentage * 100) / 100).toFixed(2)));

    try {
      const { error } = await supabase
        .from('songs')
        .update({
          co_writers: names,
          split_percentages: percentages
        })
        .eq('id', collaboratorSong.id);

      if (error) {
        throw error;
      }

      setSongs((prev) =>
        prev.map((song) =>
          song.id === collaboratorSong.id
            ? { ...song, co_writers: names, split_percentages: percentages }
            : song
        )
      );

      setCollaboratorSong((prev) =>
        prev ? { ...prev, co_writers: names, split_percentages: percentages } : prev
      );

      const remainingPercentage = Math.max(0, Number((100 - totalPercentage).toFixed(2)));

      toast({
        title: 'Collaborators updated',
        description: names.length
          ? `${ownerDisplayName} now keeps ${remainingPercentage}% of this song.`
          : 'You now keep 100% of this song.'
      });

      closeCollaboratorDialog();
    } catch (error) {
      console.error('Error updating collaborators:', error);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not save collaborator splits. Please try again.'
      });
    }
  };

  const createStreamingStatsRecord = async (
    songId: string,
    totalStreams: number
  ): Promise<StreamingStatsBreakdownEntry[]> => {
    if (!user) {
      return [];
    }

    try {
      const { data: accountData, error: accountsError } = await supabase
        .from('player_streaming_accounts')
        .select(`
          id,
          followers,
          platform:streaming_platforms!player_streaming_accounts_platform_id_fkey (
            id,
            name,
            revenue_per_play
          )
        `)
        .eq('user_id', user.id)
        .eq('is_connected', true);

      if (accountsError) {
        throw accountsError;
      }

      const breakdown = buildInitialStreamingBreakdown(
        totalStreams,
        (accountData as StreamingAccountRecord[] | null | undefined)
      );

      const totalRevenue = breakdown.reduce((sum, entry) => sum + entry.revenue, 0);
      const breakdownPayload = breakdown.map((entry) => ({
        platform_id: entry.platformId ?? null,
        key: entry.key,
        name: entry.name,
        streams: entry.streams,
        revenue: Number(entry.revenue.toFixed(2)),
        revenue_per_play: entry.revenuePerPlay
      }));

      const { error: statsError } = await supabase
        .from('streaming_stats')
        .upsert({
          song_id: songId,
          user_id: user.id,
          total_streams: totalStreams,
          total_revenue: Number(totalRevenue.toFixed(2)),
          platform_breakdown: breakdownPayload as Json
        }, {
          onConflict: 'song_id'
        });

      if (statsError) {
        throw statsError;
      }

      return breakdown;
    } catch (statsError) {
      console.error('Error creating streaming stats:', statsError);
      return [];
    }
  }, [user]);

  const enqueueStreamingSimulation = useCallback(async (
    songId: string,
    totalStreams: number,
    breakdown: StreamingStatsBreakdownEntry[]
  ) => {
    if (breakdown.length === 0 || totalStreams <= 0) {
      return;
    }

    try {
      await supabase.functions.invoke('queue-streaming-simulation', {
        body: {
          songId,
          totalStreams,
          breakdown: breakdown.map((entry) => ({
            key: entry.key,
            name: entry.name,
            streams: entry.streams,
            revenue: Number(entry.revenue.toFixed(2))
          }))
        }
      });
    } catch (jobError) {
      // The edge function may not be configured in all environments.
      console.info('Streaming simulation job not queued:', jobError);
    }
  }, []);

  const fetchSongs = useCallback(async () => {
    if (!user?.id) {
      setSongs([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSongs((data || []).map(normalizeSongRecord));
    } catch (error: any) {
      console.error('Error fetching songs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load songs"
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  const fetchGrowthHistory = useCallback(async () => {
    if (!user?.id) {
      setGrowthHistory([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('song_stream_growth_history')
        .select('id, song_id, user_id, streams_added, revenue_added, recorded_at, songs(title)')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setGrowthHistory((data || []).map(normalizeGrowthRecord));
    } catch (error) {
      console.error('Error fetching song growth:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setSongs([]);
      setGrowthHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSongs();
    fetchGrowthHistory();
  }, [user?.id, fetchSongs, fetchGrowthHistory]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const interval = setInterval(() => {
      fetchSongs();
      fetchGrowthHistory();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [user?.id, fetchSongs, fetchGrowthHistory]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`songs-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const normalized = normalizeSongRecord(payload.new);
            setSongs((prev) => {
              const exists = prev.some((song) => song.id === normalized.id);

              if (exists) {
                return prev.map((song) =>
                  song.id === normalized.id ? { ...song, ...normalized } : song
                );
              }

              return [normalized, ...prev].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              );
            });
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const normalized = normalizeSongRecord(payload.new);
            setSongs((prev) =>
              prev.map((song) =>
                song.id === normalized.id ? { ...song, ...normalized } : song
              )
            );
          }

          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setSongs((prev) => prev.filter((song) => song.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`song-growth-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'song_stream_growth_history',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (!payload.new) {
            return;
          }

          const normalized = normalizeGrowthRecord(payload.new);
          setGrowthHistory((prev) => {
            if (prev.some((entry) => entry.id === normalized.id)) {
              return prev;
            }

            const updated = [normalized, ...prev];
            return updated.slice(0, 200);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dailyGrowth = useMemo(
    () => summarizeGrowth(growthHistory, songs, 1, ownerDisplayName),
    [growthHistory, songs, ownerDisplayName]
  );

  const weeklyGrowth = useMemo(
    () => summarizeGrowth(growthHistory, songs, 7, ownerDisplayName),
    [growthHistory, songs, ownerDisplayName]
  );

  const createSong = async () => {
    if (!user || !newSong.title || !newSong.genre) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a title and genre for your song."
      });
      return;
    }

    try {
      const qualityScore = Math.floor(
        ((skills?.songwriting || 0) + (skills?.performance || 0)) / 2 + 
        Math.random() * 20 - 10
      );

      const { data, error } = await supabase
        .from('songs')
        .insert([{
          title: newSong.title,
          genre: newSong.genre,
          lyrics: newSong.lyrics,
          quality_score: Math.max(1, Math.min(100, qualityScore)),
          status: 'draft',
          streams: 0,
          revenue: 0,
          co_writers: [],
          split_percentages: [],
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setSongs(prev => [normalizeSongRecord(data), ...prev]);
      setNewSong({ title: '', genre: '', lyrics: '' });
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Song Created",
        description: `"${data.title}" has been added to your collection!`
      });
    } catch (error: any) {
      console.error('Error creating song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create song"
      });
    }
  };

  const recordSong = async (song: Song) => {
    if (!profile || profile.cash < 500) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: "Recording costs $500. You need more cash!"
      });
      return;
    }

    try {
      const recordingBonus = (skills?.performance || 0) / 4;
      const finalQuality = Math.min(100, song.quality_score + recordingBonus);

      const { error } = await supabase
        .from('songs')
        .update({
          status: 'recorded',
          quality_score: finalQuality
        })
        .eq('id', song.id);

      if (error) throw error;

      await updateProfile({ cash: profile.cash - 500 });

      setSongs(prev => prev.map(s => 
        s.id === song.id 
          ? { ...s, status: 'recorded' as const, quality_score: finalQuality }
          : s
      ));

      setIsRecordDialogOpen(false);
      
      toast({
        title: "Song Recorded",
        description: `"${song.title}" has been professionally recorded!`
      });
    } catch (error: any) {
      console.error('Error recording song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record song"
      });
    }
  };

  const releaseSong = useCallback(async (song: Song, triggeredAutomatically = false) => {
    if (song.status !== 'recorded') {
      if (!triggeredAutomatically) {
        toast({
          variant: "destructive",
          title: "Cannot Release",
          description: "Song must be recorded before release!"
        });
      }
      return;
    }

    const releaseDate = parseIsoDate(song.release_date) ?? new Date();
    const now = new Date();
    if (releaseDate.getTime() > now.getTime()) {
      if (!triggeredAutomatically) {
        toast({
          title: "Release Scheduled",
          description: `"${song.title}" will be released on ${releaseDate.toLocaleString()}.`
        });
      }
      return;
    }

    const currentProfile = profileRef.current;
    if (!user || !currentProfile) {
      if (!triggeredAutomatically) {
        toast({
          variant: "destructive",
          title: "Missing Player Data",
          description: "Please sign in and load your profile before releasing a song."
        });
      }
      return;
    }

    if (releasingSongsRef.current.has(song.id)) {
      return;
    }

    releasingSongsRef.current.add(song.id);

    try {
      const marketingBudget = Math.max(0, Number(song.marketing_budget ?? 0));
      const fans = Number(currentProfile.fans ?? 0);
      const baseStreams = Math.floor(song.quality_score * fans / 100);
      const marketingBoost = Math.floor(marketingBudget * 20);
      const initialStreams = Math.max(baseStreams + marketingBoost, 0);
      const chartBonus = Math.floor(marketingBudget / 500);
      const chartPosition = Math.max(1, 101 - Math.floor(song.quality_score * 0.8) - chartBonus);
      const releaseTimestamp = releaseDate.toISOString();
      const royaltyEarnings = Number((initialStreams * 0.01).toFixed(2));
      const ownerPercentage = calculateOwnerPercentage(song);
      const ownerRevenueShare = Number(((royaltyEarnings * ownerPercentage) / 100).toFixed(2));
      const collaboratorShares = calculateCollaboratorShares(
        { ...song, streams: initialStreams, revenue: royaltyEarnings },
        ownerDisplayName
      );
      const { error } = await supabase
        .from('songs')
        .update({
          status: 'released',
          release_date: releaseTimestamp,
          streams: initialStreams,
          chart_position: chartPosition,
          revenue: royaltyEarnings,
          marketing_budget: marketingBudget
        })
        .eq('id', song.id);

      if (error) throw error;

      const { cashToPlayer, totalRecouped } = await applyRoyaltyRecoupment(user.id, ownerRevenueShare);
      const fameGain = Math.floor(song.quality_score / 2);
      const updatedFame = (currentProfile.fame ?? 0) + fameGain;
      const newCashTotal = (currentProfile.cash ?? 0) - marketingBudget + cashToPlayer;

      const updatedProfile = await updateProfile({
        fame: updatedFame,
        cash: newCashTotal
      });

      if (updatedProfile) {
        profileRef.current = updatedProfile;
      } else {
        profileRef.current = {
          ...currentProfile,
          fame: updatedFame,
          cash: newCashTotal
        } as typeof currentProfile;
      }

      setSongs(prev => prev.map(s =>
        s.id === song.id
          ? {
              ...s,
              status: 'released' as const,
              release_date: releaseTimestamp,
              streams: initialStreams,
              chart_position: chartPosition,
              revenue: royaltyEarnings,
              marketing_budget: marketingBudget
            }
          : s
      ));

      const royaltiesFormatted = royaltyEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const playerShareFormatted = ownerRevenueShare.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const recoupedFormatted = totalRecouped.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const cashAddedFormatted = cashToPlayer.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const marketingFormatted = marketingBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const introMessage = triggeredAutomatically
        ? `Your scheduled release "${song.title}" is now live!`
        : `"${song.title}" is now available to fans!`;
      const fameMessage = ` +${fameGain} fame.`;
      const royaltyMessage = totalRecouped > 0
        ? ` Earned $${royaltiesFormatted} overall with ${ownerDisplayName} receiving $${playerShareFormatted} (${ownerPercentage.toFixed(2)}% share). $${recoupedFormatted} applied toward your advance and $${cashAddedFormatted} added to cash.`
        : ` Earned $${royaltiesFormatted} overall with ${ownerDisplayName} receiving $${playerShareFormatted} (${ownerPercentage.toFixed(2)}% share). $${cashAddedFormatted} added to cash.`;
      const collaboratorSummary = collaboratorShares
        .filter((share) => !share.isOwner)
        .map((share) => `${share.name} ${share.percentage.toFixed(2)}%`)
        .join(' · ');

      toast({
        title: "Song Released",
        description: baseMessage + royaltyMessage + (collaboratorSummary ? ` Splits: ${collaboratorSummary}.` : '')
      });
    } catch (error: any) {
      console.error('Error releasing song:', error);
      const description = triggeredAutomatically
        ? `We couldn't complete the scheduled release of "${song.title}". Please review the song details and try again.`
        : "Failed to release song";
      toast({
        variant: "destructive",
        title: "Release Error",
        description
      });
    } finally {
      releasingSongsRef.current.delete(song.id);
    }
  }, [createStreamingStatsRecord, enqueueStreamingSimulation, toast, updateProfile, user]);

  const openReleaseDialog = (song: Song) => {
    setSelectedSong(song);
    const releaseDateValue = (() => {
      const parsed = parseIsoDate(song.release_date);
      if (!parsed) {
        return new Date();
      }
      return parsed.getTime() < Date.now() ? new Date() : parsed;
    })();

    setReleaseForm({
      releaseDate: formatDateTimeLocal(releaseDateValue),
      marketingBudget: Number(song.marketing_budget ?? 0)
    });
    setIsReleaseDialogOpen(true);
  };

  const scheduleRelease = async () => {
    if (!selectedSong) {
      return;
    }

    const currentProfile = profileRef.current;
    if (!user || !currentProfile) {
      toast({
        variant: "destructive",
        title: "Missing Player Data",
        description: "Please sign in and load your profile before scheduling a release."
      });
      return;
    }

    if (!releaseForm.releaseDate) {
      toast({
        variant: "destructive",
        title: "Invalid Release Date",
        description: "Please choose when you want the song to go live."
      });
      return;
    }

    const parsedDate = new Date(releaseForm.releaseDate);
    if (Number.isNaN(parsedDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid Release Date",
        description: "Please provide a valid date and time for the release."
      });
      return;
    }

    const marketingBudget = Math.max(0, Number.isFinite(releaseForm.marketingBudget)
      ? releaseForm.marketingBudget
      : 0);

    if (marketingBudget > (currentProfile.cash ?? 0)) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: "Your marketing budget exceeds your available cash."
      });
      return;
    }

    try {
      const releaseTimestamp = parsedDate.toISOString();
      const updates = {
        release_date: releaseTimestamp,
        marketing_budget: marketingBudget
      };

      const { error } = await supabase
        .from('songs')
        .update(updates)
        .eq('id', selectedSong.id);

      if (error) throw error;

      setSongs(prev => prev.map(song =>
        song.id === selectedSong.id
          ? { ...song, ...updates }
          : song
      ));
      setSelectedSong(prev =>
        prev && prev.id === selectedSong.id
          ? { ...prev, ...updates }
          : prev
      );
      setIsReleaseDialogOpen(false);

      const updatedSong: Song = {
        ...selectedSong,
        ...updates
      };

      if (parsedDate.getTime() <= Date.now()) {
        await releaseSong(updatedSong, false);
      } else {
        toast({
          title: "Release Scheduled",
          description: `"${selectedSong.title}" will be released on ${parsedDate.toLocaleString()} with a $${marketingBudget.toLocaleString()} marketing campaign.`
        });
      }
    } catch (error: any) {
      console.error('Error scheduling release:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to schedule song release"
      });
    }
  };

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const checkScheduledReleases = () => {
      if (!profileRef.current) {
        return;
      }

      const nowTime = Date.now();
      const readySongs = songsRef.current.filter((song) => {
        if (song.status !== 'recorded') {
          return false;
        }

        const scheduled = parseIsoDate(song.release_date);
        return scheduled !== null && scheduled.getTime() <= nowTime;
      });

      readySongs.forEach((readySong) => {
        releaseSong(readySong, true);
      });
    };

    checkScheduledReleases();

    const interval = setInterval(checkScheduledReleases, 15000);

    return () => clearInterval(interval);
  }, [releaseSong, user?.id]);

  const deleteSong = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);

      if (error) throw error;

      setSongs(prev => prev.filter(s => s.id !== songId));
      setGrowthHistory(prev => prev.filter(record => record.song_id !== songId));

      toast({
        title: "Song Deleted",
        description: "Song has been removed from your collection"
      });
    } catch (error: any) {
      console.error('Error deleting song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete song"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'recorded': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'released': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDisplayStatus = (song: Song) => {
    if (song.status === 'recorded') {
      const scheduled = parseIsoDate(song.release_date);
      if (scheduled && scheduled.getTime() > Date.now()) {
        return 'scheduled';
      }
    }

    return song.status;
  };

  const renderGrowthPanel = (summary: GrowthSummary, windowLabel: string) => {
    if (summary.totals.streams <= 0) {
      return (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No streaming activity recorded in the {windowLabel}.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Stream growth captured over the {windowLabel}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Total Streams</p>
            <p className="text-2xl font-bold">{summary.totals.streams.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Streaming Revenue</p>
            <p className="text-2xl font-bold">${summary.totals.revenue.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Active Songs</p>
            <p className="text-2xl font-bold">{summary.bySong.length}</p>
          </div>
        </div>
        <div className="space-y-2">
          {summary.bySong.slice(0, 5).map((entry, index) => (
            <div
              key={entry.songId}
              className="flex items-center justify-between rounded-lg border bg-background/60 px-4 py-2"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  #{index + 1}
                </Badge>
                <div>
                  <p className="font-semibold">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    +{entry.streams.toLocaleString()} streams · +${entry.revenue.toFixed(2)}
                  </p>
                  {entry.shares.length > 1 && (
                    <p className="text-[11px] text-muted-foreground">
                      {entry.shares
                        .map(
                          (share) =>
                            `${share.name}: +${share.streams.toLocaleString()} streams · $${share.revenue.toFixed(2)}`
                        )
                        .join(' • ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalSongs = songs.length;
  const releasedSongs = songs.filter(s => s.status === 'released').length;
  const totalStreams = songs.reduce((sum, s) => sum + s.streams, 0);
  const totalRevenue = songs.reduce((sum, s) => sum + s.revenue, 0);
  const bestChart = Math.min(...songs.filter(s => s.chart_position).map(s => s.chart_position!)) || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <Music className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-lg text-foreground">Loading your songs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Song Manager
          </h1>
          <p className="text-lg text-muted-foreground">
            Create, record, and release your musical masterpieces
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Music className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{totalSongs}</div>
              <div className="text-sm text-muted-foreground">Total Songs</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold">{releasedSongs}</div>
              <div className="text-sm text-muted-foreground">Released</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Play className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{totalStreams.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Streams</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">#{bestChart || 'N/A'}</div>
              <div className="text-sm text-muted-foreground">Best Chart</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Revenue</div>
            </CardContent>
          </Card>
        </div>

        {/* Streaming Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Streaming Growth</CardTitle>
            <CardDescription>
              Automatic audience growth based on song quality and marketing skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>
              <TabsContent value="daily" className="mt-4">
                {renderGrowthPanel(dailyGrowth, 'last 24 hours')}
              </TabsContent>
              <TabsContent value="weekly" className="mt-4">
                {renderGrowthPanel(weeklyGrowth, 'last 7 days')}
              </TabsContent>
            </Tabs>
            <p className="mt-4 text-xs text-muted-foreground">
              Streaming metrics refresh automatically every 15 minutes.
            </p>
          </CardContent>
        </Card>

        {/* Create Song Button */}
        <div className="flex justify-end">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Song
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Song</DialogTitle>
                <DialogDescription>
                  Start working on your next musical masterpiece
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Song Title</Label>
                  <Input
                    id="title"
                    value={newSong.title}
                    onChange={(e) => setNewSong(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter song title"
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={newSong.genre} onValueChange={(value) => setNewSong(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lyrics">Lyrics (Optional)</Label>
                  <Textarea
                    id="lyrics"
                    value={newSong.lyrics}
                    onChange={(e) => setNewSong(prev => ({ ...prev, lyrics: e.target.value }))}
                    placeholder="Write your lyrics here..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createSong}>Create Song</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Songs List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {songs.map((song) => {
            const shareBreakdown = calculateCollaboratorShares(song, ownerDisplayName);
            const hasCollaborators = song.co_writers.length > 0;
            const ownerShareLabel = shareBreakdown[0]?.percentage ?? 100;

            return (
              <Card key={song.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{song.title}</CardTitle>
                      <CardDescription>{song.genre}</CardDescription>

                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Quality</span>
                      <span>{song.quality_score}/100</span>
                    </div>
                    <Progress value={song.quality_score} className="h-2" />
                  </div>

                  {isScheduled && releaseDate && (
                    <div className="rounded-md border border-dashed border-purple-300/60 bg-purple-50/10 p-3 text-sm">
                      <p className="font-semibold">Scheduled Release</p>
                      <p className="text-xs text-muted-foreground">
                        {releaseDate.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Marketing budget: ${marketingBudget.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {song.status === 'released' && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Streams:</span>
                        <span>{song.streams.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Chart Position:</span>
                        <span>#{song.chart_position}</span>
                      </div>
                      {song.release_date && (
                        <div className="flex justify-between">
                          <span>Release Date:</span>
                          <span>{new Date(song.release_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {marketingBudget > 0 && (
                        <div className="flex justify-between">
                          <span>Marketing Spend:</span>
                          <span>${marketingBudget.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span>${song.revenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Splits</span>
                      <span>{ownerShareLabel.toFixed(2)}% yours</span>
                    </div>
                    <div className="space-y-1">
                      {shareBreakdown.map((share) => (
                        <div key={share.id} className="flex items-center justify-between text-xs">
                          <span className={share.isOwner ? 'font-semibold' : ''}>
                            {share.isOwner && share.name !== 'You'
                              ? `${share.name} (You)`
                              : share.isOwner
                                ? 'You'
                                : share.name}
                          </span>
                          <span className="text-muted-foreground">
                            {share.percentage.toFixed(2)}% · {share.streams.toLocaleString()} streams · ${share.revenue.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!hasCollaborators && (
                      <p className="text-xs text-muted-foreground">
                        Invite co-writers to share future revenue and streaming growth.
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => openCollaboratorDialog(song)}
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Manage Collaborators
                  </Button>
                </div>

                <div className="flex gap-2">
                  {song.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSong(song);
                        setIsRecordDialogOpen(true);
                      }}
                    >
                      Record ($500)
                    </Button>
                  )}

                  <div className="flex gap-2">
                    {song.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSong(song);
                          setIsRecordDialogOpen(true);
                        }}
                      >
                        Record ($500)
                      </Button>
                    )}

                    {song.status === 'recorded' && (
                      <Button
                        size="sm"
                        onClick={() => openReleaseDialog(song)}
                      >
                        {isScheduled ? 'Manage Release' : 'Schedule Release'}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteSong(song.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteSong(song.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
              </Card>
            );
          })}
        </div>

        {songs.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Songs Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start your musical journey by creating your first song!
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Song
              </Button>
            </CardContent>
          </Card>
        )}
        <Dialog open={isCollaboratorDialogOpen} onOpenChange={(open) => (!open ? closeCollaboratorDialog() : undefined)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Collaborators</DialogTitle>
              <DialogDescription>
                Invite co-writers and adjust revenue splits for "{collaboratorSong?.title}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  {ownerDisplayName} keeps{' '}
                  <span className="font-semibold">{collaboratorPreviewOwnerPercentage.toFixed(2)}%</span>{' '}
                  of this song.
                </p>
                <p>Splits must total 100% or less. Any remaining share stays with you.</p>
              </div>

              <div className="space-y-4">
                {collaboratorsForm.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
                  >
                    <div>
                      <Label htmlFor={`collaborator-${index}`}>Collaborator</Label>
                      <Input
                        id={`collaborator-${index}`}
                        value={row.collaborator}
                        onChange={(event) => updateCollaboratorRow(index, 'collaborator', event.target.value)}
                        placeholder="collaborator@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`percentage-${index}`}>Split %</Label>
                      <Input
                        id={`percentage-${index}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={row.percentage}
                        onChange={(event) => updateCollaboratorRow(index, 'percentage', event.target.value)}
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCollaboratorRow(index)}
                        aria-label="Remove collaborator"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addCollaboratorRow} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Add Collaborator
                </Button>
              </div>

              {collaboratorPreviewShares.length > 0 && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground">Preview distribution</p>
                  {collaboratorPreviewShares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between">
                      <span className={share.isOwner ? 'font-semibold' : ''}>
                        {share.isOwner && share.name !== 'You'
                          ? `${share.name} (You)`
                          : share.isOwner
                            ? 'You'
                            : share.name}
                      </span>
                      <span>
                        {share.percentage.toFixed(2)}% · {share.streams.toLocaleString()} streams · ${share.revenue.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeCollaboratorDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveCollaborators} disabled={!collaboratorSong}>
                Save Splits
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Song Dialog */}
        <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Song</DialogTitle>
              <DialogDescription>
                Record "{selectedSong?.title}" in a professional studio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Recording Details</h4>
                <ul className="text-sm space-y-1">
                  <li>• Cost: $500</li>
                  <li>• Quality boost based on Performance skill</li>
                  <li>• Professional production</li>
                  <li>• Required before release</li>
                </ul>
              </div>
              <div className="text-sm text-muted-foreground">
                Current Cash: ${profile?.cash?.toLocaleString() || 0}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => selectedSong && recordSong(selectedSong)}
                disabled={!profile || profile.cash < 500}
              >
                Record Song ($500)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SongManager;