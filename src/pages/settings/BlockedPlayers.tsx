import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BLOCK_REASON_OPTIONS } from "@/services/socialSafety";
import { useBlockedPlayers } from "@/hooks/useSocialSafety";

export default function BlockedPlayersPage() {
  const [search, setSearch] = useState("");
  const blocked = useBlockedPlayers(search);
  const reasonLabel = (value?: string | null) => BLOCK_REASON_OPTIONS.find((item) => item.value === value)?.label ?? "No reason stored";
  return <FMPageScaffold title="Blocked players" subtitle="Manage players you have blocked. Unblocking does not restore friendships or previous invitations." icon={Shield} backTo="/social" backLabel="Back to Social"><div className="space-y-4"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search blocked players" aria-label="Search blocked players" />{blocked.isLoading && <Card><CardContent className="p-6" aria-live="polite">Loading blocked players…</CardContent></Card>}{blocked.isError && <Card role="alert"><CardContent className="p-6 text-destructive">Safety settings unavailable. Please try again.</CardContent></Card>}{!blocked.isLoading && !blocked.isError && !(blocked.data ?? []).length && <Card><CardContent className="space-y-2 p-6 text-center"><p className="font-medium">No blocked players</p><p className="text-sm text-muted-foreground">Players you block will appear here. They will not be notified.</p></CardContent></Card>}<div className="space-y-3">{(blocked.data ?? []).map((row) => <Card key={row.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Avatar><AvatarImage src={row.avatarUrl ?? undefined} /><AvatarFallback>{row.characterName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><p className="font-medium">{row.characterName}</p><p className="text-sm text-muted-foreground">Blocked {new Date(row.createdAt).toLocaleDateString()}</p><Badge variant="outline">{reasonLabel(row.reasonCategory)}</Badge></div></div><div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link to={`/player/${row.blockedProfileId}`}>Limited profile</Link></Button><Button size="sm" variant="destructive" onClick={() => window.confirm("Unblock this player? Previous friendships and requests will not be restored.") && blocked.unblock.mutate(row.blockedProfileId)} disabled={blocked.unblock.isPending}>Unblock</Button></div></CardContent></Card>)}</div></div></FMPageScaffold>;
}
