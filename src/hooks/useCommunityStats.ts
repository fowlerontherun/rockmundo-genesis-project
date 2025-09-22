import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import useSupabasePresence from "./useSupabasePresence";

const DEFAULT_PRESENCE_CHANNEL = "community-presence";
const DEFAULT_REFRESH_INTERVAL_MS = 60_000;

interface UseCommunityStatsOptions {
  /**
   * User id to register with the presence channel. When omitted the hook will
   * subscribe in read-only mode and avoid contributing to the live player count.
   */
  presenceUserId?: string;
  /**
   * Override presence channel name. Defaults to `community-presence`.
   */
  presenceChannel?: string;
  /**
   * Optional explicit presence key. Useful for deterministic observers.
   */
  presenceKey?: string;
  /**
   * Refresh interval for the registered player count. Defaults to 60 seconds.
   * Set to `null` or `0` to disable automatic refreshes after the initial load.
   */
  refreshIntervalMs?: number | null;
}

interface UseCommunityStatsResult {
  registeredPlayers: number | null;
  registeredLoading: boolean;
  registeredError: string | null;
  refreshRegisteredPlayers: () => Promise<void>;
  livePlayers: number;
  livePlayersConnected: boolean;
  livePlayerIds: string[];
}

const generateObserverKey = () => `observer-${Math.random().toString(36).slice(2, 10)}`;

export const useCommunityStats = ({
  presenceUserId,
  presenceChannel = DEFAULT_PRESENCE_CHANNEL,
  presenceKey,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: UseCommunityStatsOptions = {}): UseCommunityStatsResult => {
  const shouldTrackPresence = Boolean(presenceUserId);
  const observerKey = useMemo(() => {
    if (shouldTrackPresence && presenceUserId) {
      return presenceUserId;
    }

    return presenceKey ?? generateObserverKey();
  }, [presenceKey, presenceUserId, shouldTrackPresence]);

  const [registeredPlayers, setRegisteredPlayers] = useState<number | null>(null);
  const [registeredLoading, setRegisteredLoading] = useState(true);
  const [registeredError, setRegisteredError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshRegisteredPlayers = useCallback(async () => {
    setRegisteredLoading(true);

    try {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      setRegisteredPlayers(count ?? 0);
      setRegisteredError(null);
    } catch (caught) {
      console.error("Failed to fetch registered player count:", caught);
      if (isMountedRef.current) {
        setRegisteredError("Unable to load player count");
      }
    } finally {
      if (isMountedRef.current) {
        setRegisteredLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshRegisteredPlayers();
  }, [refreshRegisteredPlayers]);

  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshRegisteredPlayers();
    }, refreshIntervalMs);

    return () => clearInterval(intervalId);
  }, [refreshIntervalMs, refreshRegisteredPlayers]);

  const { participantCount, isConnected, onlineUserIds } = useSupabasePresence({
    channelName: presenceChannel,
    userId: shouldTrackPresence ? presenceUserId : undefined,
    presenceKey: observerKey,
    trackSelf: shouldTrackPresence,
  });

  return {
    registeredPlayers,
    registeredLoading,
    registeredError,
    refreshRegisteredPlayers,
    livePlayers: participantCount,
    livePlayersConnected: isConnected,
    livePlayerIds: onlineUserIds,
  };
};

export default useCommunityStats;
