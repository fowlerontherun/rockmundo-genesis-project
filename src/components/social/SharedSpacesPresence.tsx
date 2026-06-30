import { useEffect, useState } from"react";
import { Link } from"react-router-dom";
import { Card, CardContent } from"@/components/ui/card";
import { Badge } from"@/components/ui/badge";
import { Music, Disc3, PartyPopper, Mic2 } from"lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { cn } from"@/lib/utils";

const SPACES = [
 { key:"jam-lobby", label:"Jam Lobby", icon: Music, path:"/jam-sessions"},
 { key:"studio-lobby", label:"Studio", icon: Disc3, path:"/recording-studio"},
 { key:"nightclub-floor", label:"Nightclubs", icon: PartyPopper, path:"/nightclubs"},
 { key:"festival-backstage", label:"Festival Backstage", icon: Mic2, path:"/festivals"},
] as const;

export function SharedSpacesPresence({ profileId }: { profileId: string | null }) {
 const [counts, setCounts] = useState<Record<string, number>>({});

 useEffect(() => {
 if (!profileId) return;
 const channels = SPACES.map((s) => {
 const ch = supabase.channel(`presence:${s.key}`, {
 config: { presence: { key: profileId } },
 });
 ch.on("presence", { event:"sync"}, () => {
 const state = ch.presenceState();
 const total = Object.keys(state).length;
 setCounts((prev) => ({ ...prev, [s.key]: total }));
 }).subscribe(async (status) => {
 if (status ==="SUBSCRIBED") {
 // Track as a passive observer (not occupying)
 await ch.track({ at: Date.now(), observer: true });
 }
 });
 return ch;
 });
 return () => {
 channels.forEach((c) => supabase.removeChannel(c));
 };
 }, [profileId]);

 return (
 <Card>
 <CardContent className="p-3">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-xs font-semibold text-muted-foreground tracking-wide">
 Shared Spaces
 </h3>
 <span className="text-[10px] text-muted-foreground">Live presence</span>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {SPACES.map((s) => {
 const Icon = s.icon;
 const n = Math.max(0, (counts[s.key] ?? 1) - 1); // exclude self-observer
 return (
 <Link
 key={s.key}
 to={s.path}
 className={cn("group flex items-center gap-2 rounded-md border bg-card/40 p-2 hover:bg-accent/50 transition-colors",
 )}
 >
 <Icon className="h-4 w-4 text-primary shrink-0"/>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium truncate">{s.label}</p>
 <p className="text-[10px] text-muted-foreground">
 {n === 0 ?"Empty": `${n} here now`}
 </p>
 </div>
 {n > 0 && (
 <Badge variant="secondary"className="text-[10px] h-5 px-1.5">
 {n}
 </Badge>
 )}
 </Link>
 );
 })}
 </div>
 </CardContent>
 </Card>
 );
}
