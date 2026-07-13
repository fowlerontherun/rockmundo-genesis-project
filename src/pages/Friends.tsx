import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Search, Users } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FriendCard } from "@/components/friends/FriendCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFriends, useFriendRequests } from "@/hooks/usePlayerConnections";
import { sendConnectionRequest } from "@/integrations/supabase/playerConnections";

function FriendSection({ kind, search }: { kind: "friends" | "incoming" | "outgoing" | "recent"; search: string }) {
  const friends = useFriends(kind, search);
  if (friends.isLoading) return <Card><CardContent className="p-6" aria-live="polite">Loading connections…</CardContent></Card>;
  if (friends.isError) return <Card role="alert"><CardContent className="p-6 text-destructive">Friends page unavailable. Please try again.</CardContent></Card>;
  const rows = friends.data ?? [];
  if (!rows.length) return <Card><CardContent className="space-y-3 p-6 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground" /><p className="font-medium">No {kind === "incoming" ? "incoming requests" : kind === "outgoing" ? "sent requests" : "friends"} yet.</p><Button asChild><Link to="/community/players">Discover players</Link></Button></CardContent></Card>;
  return <div className="space-y-3">{rows.map((friend) => <FriendCard key={friend.friendshipId} friend={friend} context={kind === "incoming" ? "incoming" : kind === "outgoing" ? "outgoing" : "friend"} disabled={friends.act.isPending} onAccept={() => friends.act.mutate({ friendshipId: friend.friendshipId, status: "accepted" })} onDecline={() => friends.act.mutate({ friendshipId: friend.friendshipId, status: "declined" })} onCancel={() => friends.act.mutate({ friendshipId: friend.friendshipId, status: "cancelled" })} onRemove={() => window.confirm("Remove this friend? Friends-only profile access will be lost.") && friends.act.mutate({ friendshipId: friend.friendshipId, status: "removed" })} />)}</div>;
}

export default function FriendsPage() {
  const [search, setSearch] = useState("");
  const { counts } = useFriendRequests();
  const friends = useFriends("friends", search);
  return <FMPageScaffold title="Friends" subtitle="Manage friend requests, connections, mutual friends and suggested social links." icon={Heart} backTo="/social" backLabel="Back to Social">
    <div className="space-y-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search friends by name, band, city, instrument or role" /></div>
      <Tabs defaultValue="friends"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="friends">Friends ({counts.data?.friends ?? 0})</TabsTrigger><TabsTrigger value="incoming">Incoming ({counts.data?.incoming ?? 0})</TabsTrigger><TabsTrigger value="outgoing">Sent ({counts.data?.outgoing ?? 0})</TabsTrigger><TabsTrigger value="suggested">Suggested ({friends.suggestions.data?.length ?? 0})</TabsTrigger><TabsTrigger value="recent">Recently added</TabsTrigger></TabsList>
        <TabsContent value="friends"><FriendSection kind="friends" search={search} /></TabsContent><TabsContent value="incoming"><FriendSection kind="incoming" search={search} /></TabsContent><TabsContent value="outgoing"><FriendSection kind="outgoing" search={search} /></TabsContent><TabsContent value="recent"><FriendSection kind="recent" search={search} /></TabsContent><TabsContent value="suggested"><div className="space-y-3">{(friends.suggestions.data ?? []).map((friend) => <FriendCard key={friend.id} friend={friend} context="suggestion" onAdd={() => void sendConnectionRequest(friend.id)} />)}{!friends.suggestions.isLoading && !(friends.suggestions.data ?? []).length && <Card><CardContent className="p-6 text-center">No suggestions right now.</CardContent></Card>}</div></TabsContent>
      </Tabs></div>
  </FMPageScaffold>;
}
