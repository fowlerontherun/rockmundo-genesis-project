
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Play,
  Users,
  DollarSign,
  Music,
  Share2,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import type { Database } from "@/integrations/supabase/types";

type StreamingPlatform = Database["public"]["Tables"]["streaming_platforms"]["Row"];
type PlayerStreamingAccount = Database["public"]["Tables"]["player_streaming_accounts"]["Row"];
type SongRecord = Database["public"]["Tables"]["songs"]["Row"] & {
  album?: string | null;
  plays?: number | null;
  popularity?: number | null;
  totalStreams?: number | null;
  trending?: boolean | null;
};
type PromotionCampaignRow = Database["public"]["Tables"]["promotion_campaigns"]["Row"];

interface PlatformBreakdown {
  key: string;
  label: string;
  streams: number;
  revenue: number;
}

interface PlatformMetric extends StreamingPlatform {
  monthlyListeners: number;
  monthlyStreams: number;
  monthlyRevenue: number;
  growth: number;
  isConnected: boolean;
}

interface OverviewMetrics {
  totalStreams: number;
  totalRevenue: number;
  totalListeners: number;
  streamsGrowth: number;
  revenueGrowth: number;
  listenersGrowth: number;
}

interface OverviewSnapshot {
  totalStreams: number;
  totalRevenue: number;
  totalListeners: number;
}

interface PlatformSnapshot {
  monthlyListeners: number;
  monthlyStreams: number;
  monthlyRevenue: number;
}

interface StreamingStatsRecord {
  id: string;
  song_id: string;
  user_id: string;
  total_streams: number | null;
  total_revenue: number | null;
  platform_breakdown: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

interface SongWithPlatformData {
  id: string;
  title: string;
  album?: string | null;
  genre?: string | null;
  status?: string | null;
  totalStreams: number;
  totalRevenue: number;
  platformBreakdown: PlatformBreakdown[];
  totalListeners?: number;
}

interface PromotionCampaign extends PromotionCampaignRow {
  name?: string | null;
  platform?: string | null;
  end_date?: string | null;
}

interface PromotionFunctionResponse {
  success: boolean;
  message: string;
  campaign?: PromotionCampaign | null;
  statsDelta?: {
    streams: number;
    revenue: number;
    listeners: number;
  } | null;
}

const BASE_STREAMING_STATS = {
  totalStreams: 0,
  revenue: 0,
  listeners: 0,
} as const;

const DEFAULT_REVENUE_PER_PLAY = 0.003;

interface PlatformSourceMeta {
  key: string;
  label: string;
  weight: number;
  revenuePerPlay: number;
}

const DEFAULT_PLATFORM_DISTRIBUTION: PlatformSourceMeta[] = [
  { key: "spotify", label: "Spotify", weight: 45, revenuePerPlay: 0.0032 },
  { key: "apple-music", label: "Apple Music", weight: 25, revenuePerPlay: 0.007 },
  { key: "youtube-music", label: "YouTube Music", weight: 20, revenuePerPlay: 0.0025 },
  { key: "soundcloud", label: "SoundCloud", weight: 10, revenuePerPlay: 0.002 }
];

const normalizePlatformKey = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const formatPlatformLabel = (value: string): string => {
  const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "Platform";
  }

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const buildPlatformBreakdown = (
  song: SongRecord,
  streamingPlatforms: StreamingPlatform[]
): PlatformBreakdown[] => {
  const songRecord = song as Record<string, unknown>;
  const totalStreams = safeNumber(
    songRecord.totalStreams ?? songRecord.streams ?? songRecord.plays
  );
  const totalRevenue = safeNumber(
    songRecord.totalRevenue ?? songRecord.revenue
  );

  const platformSources: PlatformSourceMeta[] = streamingPlatforms.length > 0
    ? streamingPlatforms.map((platform, index) => {
        const label = platform.name?.trim() || `Platform ${index + 1}`;
        const keyBase = platform.id?.trim() || label;
        const normalizedKey = normalizePlatformKey(keyBase);
        const weight = Math.max(safeNumber(platform.min_followers, 1), 1);
        const revenuePerPlay = safeNumber(
          platform.revenue_per_play,
          DEFAULT_REVENUE_PER_PLAY
        );

        return {
          key: platform.id ?? (normalizedKey || `platform-${index + 1}`),
          label,
          weight,
          revenuePerPlay,
        };
      })
    : DEFAULT_PLATFORM_DISTRIBUTION.map((entry) => ({ ...entry }));

  const metadataLookup = new Map<string, PlatformSourceMeta>();
  platformSources.forEach((source, index) => {
    const normalizedKey = normalizePlatformKey(source.key) || `platform-${index + 1}`;
    metadataLookup.set(normalizedKey, source);
    metadataLookup.set(normalizePlatformKey(source.label), source);
  });

  DEFAULT_PLATFORM_DISTRIBUTION.forEach((entry) => {
    const normalizedKey = normalizePlatformKey(entry.key);
    if (!metadataLookup.has(normalizedKey)) {
      metadataLookup.set(normalizedKey, entry);
    }
  });

  const rawPlatforms = songRecord.platforms;
  if (rawPlatforms && typeof rawPlatforms === "object" && !Array.isArray(rawPlatforms)) {
    const explicitEntries = Object.entries(rawPlatforms as Record<string, unknown>)
      .map(([rawKey, rawValue], index) => {
        const normalizedKey = normalizePlatformKey(rawKey);
        const metadata = metadataLookup.get(normalizedKey) ?? {
          key: normalizedKey || `platform-${index + 1}`,
          label: formatPlatformLabel(rawKey),
          weight: 1,
          revenuePerPlay: DEFAULT_REVENUE_PER_PLAY,
        };

        const streams = safeNumber(rawValue);
        const revenue = totalRevenue > 0 && totalStreams > 0
          ? (streams / totalStreams) * totalRevenue
          : streams * metadata.revenuePerPlay;

        return {
          key: metadata.key,
          label: metadata.label,
          streams,
          revenue: Number.isFinite(revenue) ? revenue : 0,
        };
      })
      .filter((entry) => entry.streams > 0 || entry.revenue > 0);

    if (explicitEntries.length > 0) {
      return explicitEntries;
    }
  }

  const sources = platformSources.length > 0
    ? platformSources
    : DEFAULT_PLATFORM_DISTRIBUTION;

  if (sources.length === 0) {
    return [];
  }

  const totalWeight = sources.reduce((sum, entry) => sum + (entry.weight || 0), 0) || sources.length;
  const allocationBasis = totalStreams > 0
    ? totalStreams
    : totalRevenue > 0
      ? Math.round(totalRevenue / DEFAULT_REVENUE_PER_PLAY)
      : 0;

  let allocatedStreams = 0;
  let allocatedRevenue = 0;

  const fallbackEntries = sources.map((source, index) => {
    const weight = source.weight > 0 ? source.weight : 1;
    const ratio = totalWeight > 0 ? weight / totalWeight : 1 / sources.length;

    let streams = 0;
    if (allocationBasis > 0) {
      streams = index === sources.length - 1
        ? Math.max(allocationBasis - allocatedStreams, 0)
        : Math.max(Math.round(allocationBasis * ratio), 0);
      allocatedStreams += streams;
    }

    let revenue = 0;
    if (totalRevenue > 0) {
      revenue = allocationBasis > 0
        ? (streams / allocationBasis) * totalRevenue
        : totalRevenue * ratio;

      if (index === sources.length - 1) {
        revenue = totalRevenue - allocatedRevenue;
      }

      allocatedRevenue += revenue;
    } else {
      revenue = streams * source.revenuePerPlay;
    }

    return {
      key: source.key,
      label: source.label,
      streams,
      revenue: Number.isFinite(revenue) ? revenue : 0,
    };
  });

  return fallbackEntries.filter((entry) => entry.streams > 0 || entry.revenue > 0);
};

const calculateGrowth = (
  previous: number | null | undefined,
  current: number | null | undefined
) => {
  if (previous === undefined || previous === null) {
    return 0;
  }

  const previousValue = Number(previous);
  const currentValue = Number(current ?? 0);

  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const standardNumberFormatter = new Intl.NumberFormat('en-US');

const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value) || value === 0) {
    return '0';
  }

  if (Math.abs(value) < 1000) {
    return standardNumberFormatter.format(Math.round(value));
  }

  return compactNumberFormatter.format(value);
};

const buildPlatformBreakdownFromStats = (
  stats: StreamingStatsRecord | undefined
): PlatformBreakdown[] | null => {
  if (!stats || !Array.isArray(stats.platform_breakdown)) {
    return null;
  }

  const entries = (stats.platform_breakdown as Array<Record<string, unknown>>)
    .map((entry, index) => {
      const entryRecord = entry as Record<string, unknown>;
      const rawKey = entryRecord.key;
      const rawName = entryRecord.name ?? entryRecord.label ?? rawKey;
      const label = typeof rawName === "string"
        ? rawName
        : typeof rawKey === "string"
          ? formatPlatformLabel(rawKey)
          : `Platform ${index + 1}`;

      const key = typeof rawKey === "string"
        ? rawKey
        : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const streams = safeNumber(entryRecord.streams);
      const revenue = entryRecord.revenue !== undefined && entryRecord.revenue !== null
        ? safeNumber(entryRecord.revenue)
        : streams * safeNumber(entryRecord["revenue_per_play"]);

      return {
        key,
        label,
        streams,
        revenue,
      };
    })
    .filter((entry) => entry.streams > 0 || entry.revenue > 0);

  return entries.length > 0 ? entries : null;
};

const formatLargeNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1);
    return `${parseFloat(formatted)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    const formatted = (value / 1_000).toFixed(1);
    return `${parseFloat(formatted)}K`;
  }
  return Math.round(value).toLocaleString();
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) {
    return '$0';
  }

  return currencyFormatter.format(value);
};

type PresetCampaignType = "playlist" | "social" | "radio";

const PRESET_CAMPAIGNS: Record<
  PresetCampaignType,
  {
    action: "promotion" | "playlist_submission";
    budget: number;
    platformKeyword: string;
    fallbackPlatformName: string;
    playlistName?: string;
  }
> = {
  playlist: {
    action: "playlist_submission",
    budget: 250,
    platformKeyword: "spotify",
    fallbackPlatformName: "Spotify",
    playlistName: "Editorial Playlist Outreach",
  },
  social: {
    action: "promotion",
    budget: 180,
    platformKeyword: "youtube",
    fallbackPlatformName: "YouTube Music",
  },
  radio: {
    action: "promotion",
    budget: 220,
    platformKeyword: "apple",
    fallbackPlatformName: "Apple Music",
  },
};

const normalizeCampaign = (campaign: PromotionCampaign): PromotionCampaign => ({
  ...campaign,
  platform: campaign.platform ?? campaign.platform_name ?? null,
});

const StreamingPlatforms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useGameData();

  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [playerAccounts, setPlayerAccounts] = useState<PlayerStreamingAccount[]>([]);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetric[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics>({
    totalStreams: 0,
    totalRevenue: 0,
    totalListeners: 0,
    streamsGrowth: 0,
    revenueGrowth: 0,
    listenersGrowth: 0,
  });
  const [userSongs, setUserSongs] = useState<SongRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [streamingStats, setStreamingStats] = useState(() => ({ ...BASE_STREAMING_STATS }));
  const [promotionSettings, setPromotionSettings] = useState<Record<string, { platformId: string; budget: number }>>({});
  const [promoting, setPromoting] = useState<Record<string, boolean>>({});
  const [playlistSubmitting, setPlaylistSubmitting] = useState<Record<string, boolean>>({});
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<string | null>(null);
  const [playlistBudget, setPlaylistBudget] = useState<number>(150);
  const [serverMessage, setServerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const platformSnapshotsRef = useRef<Record<string, PlatformSnapshot>>({});
  const overviewSnapshotRef = useRef<OverviewSnapshot | null>(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (!user) return;

    setLoading(true);

    try {
      const { data: platformsData, error: platformsError } = await supabase
        .from('streaming_platforms')
        .select('*')
        .order('name');

      if (platformsError) throw platformsError;
      setPlatforms(platformsData ?? []);

      const { data: accountsData, error: accountsError } = await supabase
        .from('player_streaming_accounts')
        .select('*')
        .eq('user_id', user.id);
      if (accountsError) throw accountsError;
      setPlayerAccounts(accountsData ?? []);
      const songsResponse = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', user.id)
        .eq('status', 'released')
        .order('created_at', { ascending: false });

      let finalSongs = songsResponse.data as SongRecord[] | null | undefined;

      if (songsResponse.error) {
        // Some environments may use user_id instead of artist_id
        if (songsResponse.error.message?.toLowerCase().includes('artist_id')) {
          const fallbackResponse = await supabase
            .from('songs')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'released')
            .order('created_at', { ascending: false });

          if (fallbackResponse.error) throw fallbackResponse.error;
          finalSongs = (fallbackResponse.data as SongRecord[]) ?? [];
        } else {
          throw songsResponse.error;
        }
      }

      const songsData: SongRecord[] = finalSongs ?? [];

      let streamingStatsData: StreamingStatsRecord[] = [];
      if (songsData.length > 0) {
        const songIds = songsData.map((song) => song.id);
        const { data: statsData, error: statsError } = await supabase
          .from('streaming_stats')
          .select('*')
          .eq('user_id', user.id)
          .in('song_id', songIds);

        if (statsError) throw statsError;
        streamingStatsData = (statsData as StreamingStatsRecord[]) || [];
      }

      const statsMap = new Map<string, StreamingStatsRecord>();
      streamingStatsData.forEach((stat) => {
        if (stat?.song_id) {
          statsMap.set(stat.song_id, stat);
        }
      });

      const streamingPlatforms = platformsData || [];
      const formattedSongs: SongWithPlatformData[] = songsData.map((song) => {
        const stats = statsMap.get(song.id);
        const statsBreakdown = buildPlatformBreakdownFromStats(stats);
        const platformBreakdown = (statsBreakdown && statsBreakdown.length > 0)
          ? statsBreakdown
          : buildPlatformBreakdown(song, streamingPlatforms);

        const breakdownStreams = platformBreakdown.reduce(
          (total, entry) => total + entry.streams,
          0
        );
        let breakdownRevenue = platformBreakdown.reduce(
          (total, entry) => total + entry.revenue,
          0
        );

        if (stats) {
          const statsRevenue = safeNumber(stats.total_revenue);
          if (statsRevenue > 0) {
            breakdownRevenue = statsRevenue;
          }
        } else if (
          breakdownRevenue === 0 &&
          song.revenue !== undefined &&
          song.revenue !== null
        ) {
          breakdownRevenue = safeNumber(song.revenue);
        }

        let totalStreamsValue =
          breakdownStreams > 0 ? breakdownStreams : safeNumber(song.streams);

        if (stats) {
          const statsStreams = safeNumber(stats.total_streams);
          if (statsStreams > 0) {
            totalStreamsValue = statsStreams;
          }
        }

        return {
          id: song.id,
          title: song.title,
          album: song.album ?? song.album_name ?? song.albumTitle ?? null,
          genre: song.genre ?? undefined,
          status: song.status ?? undefined,
          totalStreams: totalStreamsValue,
          totalRevenue: breakdownRevenue,
          platformBreakdown,
        };
      });

      setUserSongs(formattedSongs);

    } catch (error) {
      console.error('Error loading streaming data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load streaming data",
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      loadData(true);
    } else {
      setLoading(false);
    }
  }, [user, loadData]);

  useEffect(() => {
    const handleStreamingRefresh = () => {
      loadData();
    };

    window.addEventListener('streaming:refresh', handleStreamingRefresh);
    return () => window.removeEventListener('streaming:refresh', handleStreamingRefresh);
  }, [loadData]);
  const connectPlatform = async (platformId: string) => {
    if (!user || !profile) return;

    try {
      const platform = platforms.find(p => p.id === platformId);
      if (!platform) return;

      // Check if user meets requirements
      const requiredFame = platform.min_followers ?? 0;
      if ((profile.fame || 0) < requiredFame) {
        toast({
          variant: "destructive",
          title: "Requirements not met",
          description: `You need ${requiredFame.toLocaleString()} fame to connect to ${platform.name}`,
        });
        return;
      }

      // Create or update streaming account
      const { data, error } = await supabase
        .from('player_streaming_accounts')
        .upsert({
          user_id: user.id,
          platform_id: platformId,
          is_connected: true,
          followers: Math.round((profile.fame || 0) * 0.1),
          monthly_plays: 0,
          monthly_revenue: 0,
          connected_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform_id'
        });

      if (error) throw error;

      await loadData();
      toast({
        title: "Platform Connected!",
        description: `Successfully connected to ${platform.name}`,
      });
    } catch (error: unknown) {
      console.error('Error connecting platform:', error);
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Failed to connect to platform",
      });
    }
  };

  const updateCampaign = async (
    campaignId: string,
    updates: Database["public"]["Tables"]["promotion_campaigns"]["Update"]
  ) => {
    if (!user) {
      const message = "You need to be logged in to manage campaigns.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: message,
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("promotion_campaigns")
        .update(updates)
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Campaign could not be updated.");
      }

      const updatedCampaign = normalizeCampaign(data as PromotionCampaign);

      setCampaigns((previousCampaigns) =>
        previousCampaigns.map((campaign) =>
          campaign.id === campaignId ? updatedCampaign : campaign
        )
      );

      const statusMessage = updates.status
        ? `Campaign status updated to ${updates.status}.`
        : "Campaign updated successfully.";

      setServerMessage({ type: "success", text: statusMessage });
      toast({
        title: "Campaign Updated",
        description: statusMessage,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update campaign.";

      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Update failed",
        description: message,
      });
    }
  };

  const handleCreatePresetCampaign = async (presetType: PresetCampaignType) => {
    if (!user) {
      const message = "You need to be logged in to launch a campaign.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: message,
      });
      return;
    }

    if (userSongs.length === 0) {
      const message = "Release a song before launching a campaign.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "No songs available",
        description: message,
      });
      return;
    }

    const preset = PRESET_CAMPAIGNS[presetType];
    if (!preset) {
      return;
    }

    const targetSong = userSongs.reduce((best, song) => {
      const bestStreams = Number(best.totalStreams ?? best.streams ?? 0);
      const songStreams = Number(song.totalStreams ?? song.streams ?? 0);

      return songStreams > bestStreams ? song : best;
    }, userSongs[0]!);

    const targetPlatform = platforms.find((platform) =>
      platform.name.toLowerCase().includes(preset.platformKeyword)
    );

    setPromoting((previous) => ({ ...previous, [presetType]: true }));

    try {
      const { data, error } = await supabase.functions.invoke<PromotionFunctionResponse>(
        "promotions",
        {
          body: {
            action: preset.action,
            songId: targetSong.id,
            platformId: targetPlatform?.id,
            platformName: targetPlatform?.name ?? preset.fallbackPlatformName,
            budget: preset.budget,
            playlistName: preset.playlistName,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.success) {
        throw new Error(data?.message ?? "Failed to launch campaign.");
      }

      if (data.campaign) {
        const campaignRecord = normalizeCampaign(data.campaign);
        setCampaigns((previousCampaigns) => [campaignRecord, ...previousCampaigns]);
      }

      if (data.statsDelta) {
        setStreamingStats((previousStats) => ({
          totalStreams: previousStats.totalStreams + (data.statsDelta?.streams ?? 0),
          revenue: previousStats.revenue + (data.statsDelta?.revenue ?? 0),
          listeners: previousStats.listeners + (data.statsDelta?.listeners ?? 0),
        }));
      }

      setServerMessage({ type: "success", text: data.message });
      toast({
        title: "Campaign Launched!",
        description: data.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to launch campaign.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Campaign failed",
        description: message,
      });
    } finally {
      setPromoting((previous) => ({ ...previous, [presetType]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading streaming platforms...</p>
        </div>
      </div>
    );
  }

  const handlePromoteSong = (songId: string) => {
    const settings = promotionSettings[songId];

    if (!settings || !settings.platformId) {
      const message = "Select a platform before launching a promotion.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Missing information",
        description: message,
      });
      return;
    }

    const selectedPlatform = platforms.find((platform) => platform.id === settings.platformId);
    const platformName = selectedPlatform?.name ?? "your selected platform";

    setServerMessage({
      type: "success",
      text: `Promotion launched on ${platformName}.`,
    });

    toast({
      title: "Promotion Started!",
      description: `Your song is now being promoted on ${platformName}.`,
    });
  };

  const handleSubmitToPlaylist = async (playlistName: string, playlistPlatform: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: "You need to be logged in to submit songs.",
      });
      return;
    }

    if (!selectedSongForPlaylist) {
      const message = "Select a song to submit to the playlist.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "No song selected",
        description: message,
      });
      return;
    }

    if (playlistBudget <= 0) {
      const message = "Set a playlist submission budget greater than zero.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Invalid budget",
        description: message,
      });
      return;
    }

    const platformMatch = platforms.find(platform => platform.name.toLowerCase() === playlistPlatform.toLowerCase());

    setPlaylistSubmitting(prev => ({ ...prev, [playlistName]: true }));

    try {
      const { data, error } = await supabase.functions.invoke<PromotionFunctionResponse>("promotions", {
        body: {
          action: "playlist_submission",
          songId: selectedSongForPlaylist,
          platformId: platformMatch?.id,
          platformName: platformMatch?.name ?? playlistPlatform,
          budget: playlistBudget,
          playlistName,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.success) {
        throw new Error(data?.message ?? "Failed to submit playlist request.");
      }

      if (data.campaign) {
        const campaignRecord = normalizeCampaign(data.campaign);
        setCampaigns(prev => [campaignRecord, ...prev]);
      }

      if (data.statsDelta) {
        setStreamingStats(prev => ({
          totalStreams: prev.totalStreams + (data.statsDelta?.streams ?? 0),
          revenue: prev.revenue + (data.statsDelta?.revenue ?? 0),
          listeners: prev.listeners + (data.statsDelta?.listeners ?? 0),
        }));
      }

      setServerMessage({ type: "success", text: data.message });
      toast({
        title: "Playlist Submission Sent!",
        description: data.message,
      });
    } catch (error: unknown) {
      const fallbackMessage = "Failed to submit playlist request.";
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error submitting playlist request:', errorMessage, error);
      setServerMessage({ type: "error", text: errorMessage });
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`,
      });
    } finally {
      setPlaylistSubmitting(prev => ({ ...prev, [playlistName]: false }));
    }

  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            STREAMING PLATFORMS
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Manage your digital music presence and streaming revenue
          </p>
        </div>

        {serverMessage && (
          <Alert
            variant={serverMessage.type === "error" ? "destructive" : "default"}
            className="bg-card/80 border-accent"
          >
            <AlertTitle className="font-semibold">
              {serverMessage.type === "error" ? "Action Failed" : "Action Successful"}
            </AlertTitle>
            <AlertDescription>{serverMessage.text}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="songs">Songs</TabsTrigger>
            <TabsTrigger value="playlists">Playlists</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {platformMetrics.map((platform) => {
                const requiredFame = platform.min_followers ?? 0;
                const revenuePerPlay = Number(platform.revenue_per_play ?? 0);
                const growthClass = platform.growth >= 0 ? 'text-success' : 'text-destructive';
                const growthPrefix = platform.growth >= 0 ? '+' : '';

                return (
                  <Card key={platform.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{platform.icon || '🎵'}</span>
                          <CardTitle className="text-lg">{platform.name}</CardTitle>
                        </div>
                        {platform.isConnected ? (
                          <Badge className="bg-success text-success-foreground">Connected</Badge>
                        ) : (
                          <Badge variant="outline">Not Connected</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {platform.isConnected ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Listeners</span>
                            <span className="font-bold text-sm">{platform.monthlyListeners.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Streams</span>
                            <span className="text-accent font-bold text-sm">
                              {platform.monthlyStreams.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Revenue</span>
                            <span className="text-success font-bold text-sm">
                              {formatCurrency(platform.monthlyRevenue)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Growth</span>
                            <span className={`${growthClass} font-bold text-sm`}>
                              {growthPrefix}{platform.growth.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {platform.description || 'Connect to unlock insights for this platform.'}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Required Fame:</span>
                            <span className="font-bold text-sm">{requiredFame.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Revenue/Play:</span>
                            <span className="text-success font-bold text-sm">
                              ${revenuePerPlay.toFixed(4)}
                            </span>
                          </div>
                          <Button
                            onClick={() => connectPlatform(platform.id)}
                            disabled={(profile?.fame || 0) < requiredFame}
                            className="w-full bg-gradient-primary"
                          >
                            Connect
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Total Streams
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatCompactNumber(overviewMetrics.totalStreams)}
                  </div>
                  <p className="text-cream/60 text-sm">
                    {overviewMetrics.streamsGrowth >= 0 ? '+' : ''}
                    {overviewMetrics.streamsGrowth.toFixed(1)}% vs last update
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Streaming Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatCurrency(overviewMetrics.totalRevenue)}
                  </div>
                  <p className="text-cream/60 text-sm">
                    {overviewMetrics.revenueGrowth >= 0 ? '+' : ''}
                    {overviewMetrics.revenueGrowth.toFixed(1)}% vs last update
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Listeners
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatCompactNumber(overviewMetrics.totalListeners)}
                  </div>
                  <p className="text-cream/60 text-sm">
                    {overviewMetrics.listenersGrowth >= 0 ? '+' : ''}
                    {overviewMetrics.listenersGrowth.toFixed(1)}% vs last update
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          <TabsContent value="songs" className="space-y-6">
            <div className="space-y-4">
              {userSongs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Released Songs</h3>
                    <p className="text-muted-foreground">Release some songs in the Music Studio to see them here!</p>
                  </CardContent>
                </Card>
              ) : (

                userSongs.map((song) => {
                  const totalStreams = song.totalStreams ?? song.streams ?? 0;
                  const totalPlays = song.plays ?? song.streams ?? 0;
                  const songRevenue = typeof song.revenue === 'number' ? song.revenue : Number(song.revenue ?? 0);
                  const popularity = song.popularity ?? 0;
                  const trending = Boolean(song.trending);
                  const album = song.album ?? 'Single';
                  const genre = song.genre ?? 'Unknown';
                  const status = song.status ?? 'draft';

                  return (
                    <Card key={song.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                          <div className="lg:col-span-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-cream">{song.title}</h3>
                              {trending && (
                                <Badge className="bg-accent text-background text-xs">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Trending
                                </Badge>
                              )}
                            </div>
                            <p className="text-cream/60">{album}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-accent font-bold">
                                {(totalStreams / 1000000).toFixed(1)}M streams
                              </span>
                              <span className="text-cream/80">
                                ${songRevenue.toLocaleString()} revenue
                              </span>
                            </div>
                          </div>

                          <div className="lg:col-span-2 space-y-2">
                            <p className="text-cream/60 text-sm">Platform Breakdown</p>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span>Total Plays</span>
                                <span className="text-accent">{totalPlays.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>Popularity</span>
                                <span className="text-accent">{Math.round(popularity)}/100</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>Quality</span>
                                <span className="text-accent">{song.quality_score}/100</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>Status</span>
                                <span className="text-accent capitalize">{status}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-center space-y-1">
                              <p className="text-muted-foreground text-sm">Genre</p>
                              <p className="text-lg font-bold text-accent">{genre}</p>
                            </div>
                            <div className="space-y-2">
                              <Button
                                size="sm"
                                className="w-full bg-gradient-primary"
                                onClick={() =>
                                  toast({
                                    title: "Feature Coming Soon!",
                                    description: "Song promotion will be available soon!",
                                  })
                                }
                              >
                                <Share2 className="h-4 w-4 mr-1" />
                                Promote
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="playlists" className="space-y-6">
            {userSongs.length > 0 && (
              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">Submission Preferences</CardTitle>
                  <CardDescription>Select the song and budget for playlist submissions</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playlist-song-select" className="text-sm text-muted-foreground">
                      Song to Submit
                    </Label>
                    <Select
                      value={selectedSongForPlaylist ?? undefined}
                      onValueChange={(value) => setSelectedSongForPlaylist(value)}
                    >
                      <SelectTrigger
                        id="playlist-song-select"
                        className="bg-background/40 border-accent/30"
                      >
                        <SelectValue placeholder="Choose a released song" />
                      </SelectTrigger>
                      <SelectContent>
                        {userSongs.map(song => (
                          <SelectItem key={song.id} value={song.id}>
                            {song.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playlist-budget-input" className="text-sm text-muted-foreground">
                      Submission Budget ($)
                    </Label>
                    <Input
                      id="playlist-budget-input"
                      type="number"
                      min={25}
                      value={playlistBudget}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setPlaylistBudget(Number.isFinite(value) ? value : 0);
                      }}
                      className="bg-background/40 border-accent/30"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">Indie Rock Hits</CardTitle>
                  <CardDescription>Spotify • 450K followers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Songs Included</span>
                      <span className="text-accent">2</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Monthly Streams</span>
                      <span className="text-accent">180K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Position</span>
                      <span className="text-accent">#12, #28</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleSubmitToPlaylist("Indie Rock Hits", "Spotify")}
                    disabled={playlistSubmitting["Indie Rock Hits"] || !selectedSongForPlaylist}
                  >
                    {playlistSubmitting["Indie Rock Hits"] ? "Submitting..." : "Submit New Song"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">New Rock</CardTitle>
                  <CardDescription>Apple Music • 220K followers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Songs Included</span>
                      <span className="text-accent">1</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Monthly Streams</span>
                      <span className="text-accent">95K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Position</span>
                      <span className="text-accent">#7</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleSubmitToPlaylist("New Rock", "Apple Music")}
                    disabled={playlistSubmitting["New Rock"] || !selectedSongForPlaylist}
                  >
                    {playlistSubmitting["New Rock"] ? "Submitting..." : "Submit New Song"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">Rock Essentials</CardTitle>
                  <CardDescription>YouTube Music • 380K followers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Songs Included</span>
                      <span className="text-accent">3</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Monthly Streams</span>
                      <span className="text-accent">210K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Position</span>
                      <span className="text-accent">#5, #18, #31</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleSubmitToPlaylist("Rock Essentials", "YouTube Music")}
                    disabled={playlistSubmitting["Rock Essentials"] || !selectedSongForPlaylist}
                  >
                    {playlistSubmitting["Rock Essentials"] ? "Submitting..." : "Submit New Song"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="campaigns" className="space-y-6">
            <div className="space-y-4">
              {campaigns.length === 0 ? (
                <Card className="bg-card/80 border-accent">
                  <CardContent className="py-12 text-center space-y-2">
                    <h3 className="text-lg font-semibold text-cream">No campaigns yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Launch a promotion to see your streaming campaigns here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                campaigns.map((campaign) => {
                  const targeted = campaign.playlists_targeted ?? 0;
                  const placements = campaign.new_placements ?? 0;
                  const progress = targeted > 0 ? Math.min((placements / targeted) * 100, 100) : 0;
                  const statusLabel = campaign.status
                    ? campaign.status
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (char) => char.toUpperCase())
                    : "Unknown";
                  const isActive = campaign.status?.toLowerCase() === "active";
                  const endDateLabel = campaign.end_date
                    ? new Date(campaign.end_date).toLocaleDateString()
                    : "No end date";
                  const targetedDisplay = targeted > 0 ? targeted : '—';

                  return (
                    <Card key={campaign.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-cream">{campaign.name}</h3>
                            <Badge variant="outline">{campaign.platform}</Badge>
                            <Badge className={isActive ? "bg-green-500" : "bg-blue-500"}>
                              {statusLabel}
                            </Badge>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Budget</p>
                            <p className="text-lg font-bold text-accent">
                              ${Number(campaign.budget ?? 0).toLocaleString()}
                            </p>
                            <p className="text-cream/60 text-xs">End: {endDateLabel}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Playlist Results</p>
                            <p className="text-lg font-bold text-accent">
                              {placements}/{targetedDisplay}
                            </p>
                            <Progress value={progress} className="h-2" />
                          </div>

                          <div className="space-y-2">
                            <p className="text-cream/60 text-sm">Stream Increase</p>
                            <p className="text-lg font-bold text-accent">
                              +{Number(campaign.stream_increase ?? 0).toLocaleString()}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-accent text-accent"
                              >
                                View Details
                              </Button>
                              <Button
                                size="sm"
                                className="bg-accent hover:bg-accent/80 text-background"
                                onClick={() =>
                                  updateCampaign(campaign.id, {
                                    status: isActive ? "completed" : "active",
                                  })
                                }
                              >
                                {isActive ? "Mark Complete" : "Reactivate"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Start New Campaign</CardTitle>
                <CardDescription>Promote your music on streaming platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    className="bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleCreatePresetCampaign("playlist")}
                  >
                    Playlist Push Campaign
                  </Button>
                  <Button
                    className="bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleCreatePresetCampaign("social")}
                  >
                    Social Media Boost
                  </Button>
                  <Button
                    className="bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleCreatePresetCampaign("radio")}
                  >
                    Radio Promotion
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StreamingPlatforms;