import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useRealtimePresence } from "./useRealtimePresence";
import { usePublicPresence } from "./usePublicPresence";

interface UsePlayerPresenceStatsOptions {
  refreshInterval?: number | null;
  /** Use public presence (doesn't require auth) - for login/landing pages */
  publicMode?: boolean;
}

interface PlayerPresenceStats {
  totalPlayers: number | null;
  totalBands: number | null;
  newPlayersThisWeek: number | null;
  onlinePlayers: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const DEFAULT_REFRESH_INTERVAL = 60_000;

const isMissingRelationError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };

  if (candidate.code === "42P01") {
    return true;
  }

  const haystack = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return false;
  }

  return haystack.includes("does not exist") || haystack.includes("missing") || haystack.includes("relation") || haystack.includes("table");
};

export const usePlayerPresenceStats = (
  options: UsePlayerPresenceStatsOptions = {},
): PlayerPresenceStats => {
  const refreshInterval = options.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
  const publicMode = options.publicMode ?? false;
  const mountedRef = useRef(true);
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null);
  const [totalBands, setTotalBands] = useState<number | null>(null);
  const [newPlayersThisWeek, setNewPlayersThisWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Use public presence for unauthenticated pages (login/landing), otherwise use authenticated presence
  const { onlineCount: authOnlineCount } = useRealtimePresence();
  const { onlineCount: publicOnlineCount } = usePublicPresence();
  const onlineCount = publicMode ? publicOnlineCount : authOnlineCount;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [playersResult, bandsResult, newPlayersResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("bands")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("created_at", weekAgo),
      ]);

      for (const result of [playersResult, bandsResult, newPlayersResult]) {
        if (result.error && !isMissingRelationError(result.error)) {
          throw result.error;
        }
      }

      if (!mountedRef.current) {
        return;
      }

      setTotalPlayers(playersResult.error ? 0 : playersResult.count ?? 0);
      setTotalBands(bandsResult.error ? 0 : bandsResult.count ?? 0);
      setNewPlayersThisWeek(newPlayersResult.error ? 0 : newPlayersResult.count ?? 0);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to load player presence stats", err);

      if (!mountedRef.current) {
        return;
      }

      setError("Community stats are temporarily unavailable.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchStats();

    if (!refreshInterval || refreshInterval <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchStats();
    }, refreshInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchStats, refreshInterval]);

  return {
    totalPlayers,
    totalBands,
    newPlayersThisWeek,
    onlinePlayers: onlineCount,
    loading,
    error,
    lastUpdated,
    refresh: fetchStats,
  };
};
