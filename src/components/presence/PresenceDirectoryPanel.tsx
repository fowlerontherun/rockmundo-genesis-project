import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Radio, Music2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { fetchPresenceDirectory, type PresencePlayer } from "@/services/presenceService";
import { PresenceIndicator } from "./PresenceIndicator";

export function PresenceDirectoryPanel({ cityId, title = "Live players" }: { cityId?: string | null; title?: string }) {
  const { profile, currentCity } = useGameData();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const effectiveCityId = cityId ?? currentCity?.id ?? null;
  const queryKey = useMemo(() => ["presence-directory", profile?.id, effectiveCityId, Array.from(onlineUserIds).sort().join(",")], [profile?.id, effectiveCityId, onlineUserIds]);
  const query = useQuery({ queryKey, queryFn: () => fetchPresenceDirectory(profile?.id, effectiveCityId, onlineUserIds), staleTime: 30_000 });

  useEffect(() => {
    const channel = supabase.channel("online-users");
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ user_id?: string }>();
      setOnlineUserIds(new Set(Object.values(state).flat().map((p: any) => p.user_id).filter(Boolean)));
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`presence-directory:${effectiveCityId ?? "global"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_activity_statuses" }, () => queryClient.invalidateQueries({ queryKey: ["presence-directory"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_feed" }, () => queryClient.invalidateQueries({ queryKey: ["presence-directory"] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [effectiveCityId, queryClient]);

  const data = query.data;
  const visible = data?.friends.length ? data.friends : data?.city.length ? data.city : data?.recentlyActive ?? [];
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5 text-primary" />{title}</CardTitle><CardDescription>Friends, nearby players and active sessions update live without polling.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(data?.counts ?? {}).filter(([, n]) => n > 0).slice(0, 8).map(([state, count]) => <Badge key={state} variant="outline" className="justify-between capitalize"><span>{state.replace("_", " ")}</span><span>{count}</span></Badge>)}
        {!data && <span className="text-sm text-muted-foreground">Loading live population…</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.slice(0, 9).map((player) => <PresencePlayerRow key={player.id} player={player} />)}
      </div>
      {visible.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No friends are live right now — showing recently active and nearby players as soon as they appear.</div>}
      <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="secondary"><Link to="/players/search"><Users className="mr-1 h-4 w-4" />Find players</Link></Button><Button asChild size="sm" variant="outline"><Link to="/social/recruitment"><Music2 className="mr-1 h-4 w-4" />Collaborate</Link></Button></div>
    </CardContent>
  </Card>;
}

function PresencePlayerRow({ player }: { player: PresencePlayer }) {
  const name = player.displayName || player.username || "Player";
  return <Link to={`/players/${player.id}`} className="flex min-w-0 items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
    <Avatar className="h-10 w-10"><AvatarImage src={player.avatarUrl ?? undefined} /><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{player.activity || player.cityName || "Available to meet"}</span></span>
    <PresenceIndicator state={player.presence} showLabel={false} />
  </Link>;
}
