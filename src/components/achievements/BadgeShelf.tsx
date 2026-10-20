import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Medal, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveProfile } from "@/hooks/useActiveProfile";

type Ach = { id: string; name: string; description: string | null; icon: string | null; rarity: string | null };
const db = supabase as any;

/** Pin up to three unlocked achievements as badges shown on the character. */
export function BadgeShelf() {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const qc = useQueryClient();
  const [slot, setSlot] = useState<number | null>(null);

  useEffect(() => setSlot(null), [profileId]);

  const q = useQuery({
    queryKey: ["badge-shelf", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [unlocked, pinned] = await Promise.all([
        db.from("player_achievements").select("achievement:achievements!player_achievements_achievement_id_fkey(id,name,description,icon,rarity)").eq("profile_id", profileId).not("unlocked_at", "is", null),
        db.from("profile_pinned_badges").select("slot,achievement_id").eq("profile_id", profileId),
      ]);
      if (unlocked.error) throw unlocked.error;
      if (pinned.error) throw pinned.error;
      const list = (unlocked.data ?? []).map((r: any) => r.achievement).filter(Boolean) as Ach[];
      const bySlot = new Map<number, string>((pinned.data ?? []).map((r: any) => [r.slot, r.achievement_id]));
      return { list, bySlot };
    },
  });

  const pin = async (s: number, achievementId: string | null) => {
    if (!profileId) return;
    const { error } = await db.rpc("pin_achievement_badge", { p_profile_id: profileId, p_achievement_id: achievementId, p_slot: s });
    if (error) return toast.error(error.message);
    setSlot(null);
    void qc.invalidateQueries({ queryKey: ["badge-shelf", profileId] });
  };

  const list = q.data?.list ?? [];
  const find = (id?: string) => list.find((a) => a.id === id);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Medal className="h-4 w-4 text-primary" /> Trophy cabinet</CardTitle>
        <p className="text-[11px] text-muted-foreground">Pin up to 3 unlocked achievements to show off on your character. {q.isSuccess ? `${list.length} unlocked.` : ''}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {q.isLoading && <p role="status">Loading your badges…</p>}
        {q.isError && <p role="alert">Could not load your cabinet. <button type="button" className="underline" onClick={() => void q.refetch()}>Try again</button></p>}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-amber-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-3 text-white sm:gap-4 sm:p-5">
          {[1, 2, 3].map((s) => {
            const a = find(q.data?.bySlot.get(s));
            return (
              <div key={s} className="relative min-w-0 border-b-4 border-amber-200/30 pb-3">
                <button type="button" disabled={!q.isSuccess} aria-label={`Choose badge for slot ${s}${a ? `: ${a.name}` : ''}`} aria-expanded={slot === s} onClick={() => setSlot(slot === s ? null : s)}
                  className={`flex min-h-[144px] w-full flex-col items-center justify-center rounded-lg border p-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${slot === s ? 'border-amber-300 bg-white/10' : 'border-white/10 bg-white/5'}`}>
                  <span aria-hidden="true" className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl shadow-lg ${!a ? 'border-white/20 text-white/30' : a.rarity === 'legendary' ? 'border-amber-200 bg-amber-400/20' : a.rarity === 'epic' ? 'border-purple-300 bg-purple-400/20' : a.rarity === 'rare' ? 'border-sky-300 bg-sky-400/20' : 'border-slate-300 bg-slate-400/20'}`}>
                    {a ? (a.icon && a.icon.length <= 3 ? a.icon : '🏅') : <Medal className="h-6 w-6" />}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-medium">{a?.name ?? `Empty slot ${s}`}</span>
                  {a?.rarity && <span className="mt-1 text-[10px] capitalize text-slate-300">{a.rarity}</span>}
                </button>
                {a && <button type="button" aria-label={`Unpin ${a.name}`} className="absolute right-1 top-1 rounded p-2 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => void pin(s, null)}><X className="h-3 w-3" /></button>}
              </div>
            );
          })}
        </div>
        {slot !== null && q.isSuccess && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
            <p className="text-[10px] text-muted-foreground">Pick a badge for slot {slot}</p>
            {list.length === 0 && <p className="text-muted-foreground">Unlock achievements to earn badges.</p>}
            {list.map((a) => (
              <Button key={a.id} variant="ghost" size="sm" className="h-7 w-full justify-start gap-2 text-[11px]" onClick={() => void pin(slot, a.id)}>
                <span>{a.icon && a.icon.length <= 3 ? a.icon : "🏅"}</span>{a.name}
                {a.rarity && <Badge variant="outline" className="ml-auto text-[9px]">{a.rarity}</Badge>}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
