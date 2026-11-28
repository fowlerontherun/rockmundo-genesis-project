import { supabase } from "@/integrations/supabase/client";

// A visit means an authenticated account opened an in-game route, not a public
// landing page or an admin console. The server owns both user ID and UTC date.
export function isTrackedGameRoute(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname === "/") return false;
  return !/^\/(?:admin|auth|about|privacy|terms|internal|song|privacy-policy|terms-of-service)(?:\/|$)/i.test(pathname);
}

const attemptedVisits = new Set<string>();

export function recordPlayerOpen(userId: string, at = new Date()): void {
  if (!userId) return;
  const key = `${userId}:${at.toISOString().slice(0, 10)}`;
  if (attemptedVisits.has(key)) return;
  attemptedVisits.add(key);

  // Analytics are intentionally best-effort: a missing migration or network
  // failure must never affect a player's ability to use the game.
  void (supabase.rpc as any)("record_player_open")
    .then(({ error }: { error?: { message?: string } | null }) => {
      if (error) {
        attemptedVisits.delete(key); // Allow a later route visit to retry.
        if (import.meta.env.DEV) console.debug("Player visit analytics unavailable", error.message);
      }
    })
    .catch(() => {
      attemptedVisits.delete(key);
      // Non-essential telemetry should not interrupt gameplay.
    });
}
