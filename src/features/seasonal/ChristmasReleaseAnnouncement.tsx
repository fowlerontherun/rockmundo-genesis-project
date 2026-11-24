import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Bonus = { release_id: string; release_title: string; artist_name: string; xp_per_member: number; created_at: string };
const seenKey = (userId: string) => `rockmundo:festive-release-seen:${userId}`;

function readSeen(userId: string): Set<string> {
  try { return new Set(JSON.parse(window.localStorage.getItem(seenKey(userId)) ?? "[]")); } catch { return new Set(); }
}

/** Public popup announcing each festive release that earned the Christmas XP bonus. */
export function ChristmasReleaseAnnouncement({ userId }: { userId?: string | null }) {
  const [queue, setQueue] = useState<Bonus[]>([]);

  useEffect(() => {
    if (!userId) return;
    const seen = readSeen(userId);
    const enqueue = (rows: Bonus[]) => setQueue((q) => [...q, ...rows.filter((r) => !seen.has(r.release_id) && !q.some((x) => x.release_id === r.release_id))]);
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
    void (supabase as any).from("christmas_release_bonuses")
      .select("release_id,release_title,artist_name,xp_per_member,created_at")
      .gte("created_at", since).order("created_at", { ascending: true }).limit(5)
      .then(({ data }: { data: Bonus[] | null }) => enqueue(data ?? []));
    const channel = supabase.channel(`festive-releases-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "christmas_release_bonuses" }, (p) => enqueue([p.new as Bonus]))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const current = queue[0];
  const dismiss = () => {
    if (userId && current) {
      const seen = readSeen(userId); seen.add(current.release_id);
      try { window.localStorage.setItem(seenKey(userId), JSON.stringify([...seen].slice(-100))); } catch { /* optional */ }
    }
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 sm:mx-0" aria-hidden="true">
            <Snowflake className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>A festive release has dropped!</DialogTitle>
          <DialogDescription>
            <strong>{current.artist_name}</strong> just released <strong>“{current.release_title}”</strong> and earned {current.xp_per_member} XP each for a Christmas-themed release.
          </DialogDescription>
        </DialogHeader>
        <p className="flex items-start gap-2 text-sm"><Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Release a song with “Christmas”, “Xmas” or “Snow” in the title during December to earn the same bonus.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild onClick={dismiss}><Link to="/christmas-charts">Christmas race</Link></Button>
          <Button onClick={dismiss}>Nice!</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
