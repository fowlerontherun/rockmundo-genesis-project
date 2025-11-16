import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useRealtimePresence } from "./useRealtimePresence";

interface UsePlayerPresenceStatsOptions {
  refreshInterval?: number | null;
}

interface PlayerPresenceStats {
  totalPlayers: number | null;
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
  const mountedRef = useRef(true);
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { onlineCount } = useRealtimePresence();

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
      let nextTotalPlayers = 0;

      const totalResult = await supabase.from("profiles").select("*", { count: "exact", head: true });

      if (totalResult.error) {
        if (!isMissingRelationError(totalResult.error)) {
          throw totalResult.error;
        }
      } else {
        nextTotalPlayers = totalResult.count ?? 0;
      }

      if (!mountedRef.current) {
        return;
      }

      setTotalPlayers(nextTotalPlayers);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to load player presence stats", err);

      if (!mountedRef.current) {
        return;
      }

      setError("Player counts are temporarily unavailable.");
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
    onlinePlayers: onlineCount,
    loading,
    error,
    lastUpdated,
    refresh: fetchStats,
  };
};

