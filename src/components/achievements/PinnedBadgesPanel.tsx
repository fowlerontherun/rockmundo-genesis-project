import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const db = supabase as any;

type Pinned = { slot: number; achievement: { id: string; name: string; description: string | null; icon: string | null; rarity: string | null } | null };

/** Read-only display of a character's pinned achievement badges (up to 3). */
export function PinnedBadgesPanel({ profileId, isOwn = false }: { profileId: string; isOwn?: boolean }) {
  const q = useQuery({
    queryKey: ["pinned-badges", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await db
        .from("profile_pinned_badges")
        .select("slot, achievement:achievements(id,name,description,icon,rarity)")
        .eq("profile_id", profileId)
        .order("slot");
      if (error) throw error;
      return ((data ?? []) as Pinned[]).filter((r) => r.achievement);
    },
  });

  const rows = q.data ?? [];
  if (!q.isLoading && rows.length === 0 && !isOwn) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Medal className="h-4 w-4 text-primary" /> Badges</CardTitle>
      </CardHeader>
      <CardContent className="text-xs">
        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No badges pinned yet. {isOwn && <Link to="/achievements" className="text-primary underline">Pin your achievements</Link>}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {rows.map((r) => {
              const a = r.achievement!;
              return (
                <div key={r.slot} title={a.description ?? a.name} className="flex min-h-[56px] flex-col items-center justify-center rounded border p-2 text-center">
                  <span className="text-lg leading-none">{a.icon && a.icon.length <= 3 ? a.icon : "🏅"}</span>
                  <span className="mt-1 line-clamp-2 text-[10px] font-medium">{a.name}</span>
                  {a.rarity && <Badge variant="outline" className="mt-1 text-[9px]">{a.rarity}</Badge>}
                </div>
              );
            })}
          </div>
        )}
        {isOwn && rows.length > 0 && <Link to="/achievements" className="mt-2 inline-block text-[10px] text-primary underline">Change badges</Link>}
      </CardContent>
    </Card>
  );
}
