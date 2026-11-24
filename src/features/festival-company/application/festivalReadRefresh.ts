/** Refresh RPC projections changed by other sessions without requiring Realtime.
 * Only visible, mounted reads poll; focus and reconnection also refresh data. */
export const festivalReadRefresh = {
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;
