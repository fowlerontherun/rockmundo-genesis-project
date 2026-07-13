import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ShieldOff, User } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useBlockedPlayers } from "@/hooks/social-safety/useBlockedPlayers";
import { unblockPlayer } from "@/services/social-safety/PlayerBlockService";
import { BLOCK_REASON_OPTIONS } from "@/services/social-safety/config";

export default function BlockedPlayersPage() {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(0); const { data = [], isLoading, isError } = useBlockedPlayers(search, page); const qc = useQueryClient(); const { toast } = useToast();
  const unblock = useMutation({ mutationFn: unblockPlayer, onSuccess: () => { toast({ title: "Player unblocked", description: "Previous friendships and requests were not restored." }); qc.invalidateQueries({ queryKey: ["blocked-players"] }); }, onError: (e: Error) => toast({ title: "Unblock failed", description: e.message, variant: "destructive" }) });
  return <FMPageScaffold title="Blocked Players" subtitle="Manage players you have blocked. Private activity, city and online state are hidden here." icon={ShieldOff} backTo="/settings"><Card><CardHeader><CardTitle>Search blocked players</CardTitle></CardHeader><CardContent><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search by name" /></CardContent></Card>{isLoading && <Card><CardContent className="p-6 text-center text-muted-foreground">Loading blocked players…</CardContent></Card>}{isError && <Card role="alert"><CardContent className="p-6 text-center text-destructive">Safety settings are unavailable right now.</CardContent></Card>}{!isLoading && !isError && data.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">You have not blocked any players.</CardContent></Card>}{data.map((player) => { const label = BLOCK_REASON_OPTIONS.find((o) => o.value === player.reason_category)?.label; return <Card key={player.blocked_profile_id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Avatar><AvatarImage src={player.avatar_url ?? undefined} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar><div><div className="font-medium">{player.display_name ?? player.username}</div><div className="text-sm text-muted-foreground">Blocked {format(new Date(player.created_at), "PP")}</div>{label && <Badge variant="secondary">{label}</Badge>}</div></div><Button variant="outline" disabled={unblock.isPending} onClick={() => window.confirm("Unblock this player? Previous friendships and requests will not be restored.") && unblock.mutate(player.blocked_profile_id)}>Unblock</Button></CardContent></Card>; })}<div className="flex justify-end gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button><Button variant="outline" disabled={data.length < 20} onClick={() => setPage((p) => p + 1)}>Next</Button></div></FMPageScaffold>;
}
