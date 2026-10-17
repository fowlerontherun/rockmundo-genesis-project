import { useState } from "react";
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

  const q = useQuery({
    queryKey: ["badge-shelf", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [unlocked, pinned] = await Promise.all([
        db.from("player_achievements").select("achievement:achievements!player_achievements_achievement_id_fkey(id,name,description,icon,rarity)").eq("profile_id", profileId).not("unlocked_at", "is", null),
        db.from("profile_pinned_badges").select("slot,achievement_id").eq("profile_id", profileId),
      ]);
      if (unlocked.error) throw unlocked.error;
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
        <CardTitle className="flex items-center gap-2 text-sm"><Medal className="h-4 w-4 text-primary" /> Your badges</CardTitle>
        <p className="text-[11px] text-muted-foreground">Pin up to 3 unlocked achievements to show off on your character. {list.length} unlocked.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((s) => {
            const a = find(q.data?.bySlot.get(s));
            return (
              <button key={s} type="button" onClick={() => setSlot(slot === s ? null : s)}
                className={`relative flex min-h-[56px] flex-col items-center justify-center rounded border p-2 text-center ${slot === s ? "border-primary" : "border-dashed"}`}>
                {a ? (
                  <>
                    <span className="text-lg leading-none">{a.icon && a.icon.length <= 3 ? a.icon : "🏅"}</span>
                    <span className="mt-1 line-clamp-2 text-[10px] font-medium">{a.name}</span>
                    <span role="button" aria-label="Unpin" className="absolute right-1 top-1 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); void pin(s, null); }}><X className="h-3 w-3" /></span>
                  </>
                ) : <span className="text-[10px] text-muted-foreground">Empty slot {s}</span>}
              </button>
            );
          })}
        </div>
        {slot !== null && (
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
