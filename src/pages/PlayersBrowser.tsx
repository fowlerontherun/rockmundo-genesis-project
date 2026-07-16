import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, User, Star, Music, MapPin, Users, UserPlus, Clock, Check, MessageSquare, Sparkles } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { useToast } from "@/hooks/use-toast";
import { PlayerProfileDrawer } from "@/components/players/PlayerProfileDrawer";

type BrowsePlayer = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  fame: number;
  fans: number;
  city_name: string | null;
  bands: { name: string; role: string | null }[];
};

const PAGE_SIZE = 24;

async function fetchPlayers(search: string, page: number, viewerProfileId?: string): Promise<BrowsePlayer[]> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const term = search.trim();

  let query = (supabase as any)
    .from("profiles")
    .select("id, user_id, username, display_name, avatar_url, bio, level, fame, fans, current_city_id")
    .eq("is_active", true)
    .order("fame", { ascending: false })
    .range(from, to);

  if (viewerProfileId) query = query.neq("id", viewerProfileId);
  if (term.length >= 1) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];

  const cityIds = Array.from(new Set(rows.map((r) => r.current_city_id).filter(Boolean)));
  const userIds = rows.map((r) => r.user_id).filter(Boolean);

  const [cityRes, bandRes] = await Promise.all([
    cityIds.length ? (supabase as any).from("cities").select("id, name").in("id", cityIds) : Promise.resolve({ data: [] }),
    userIds.length
      ? (supabase as any)
          .from("band_members")
          .select("user_id, instrument_role, role, bands(name)")
          .in("user_id", userIds)
          .eq("member_status", "active")
      : Promise.resolve({ data: [] }),
  ]);

  const cityMap = new Map<string, string>();
  ((cityRes as any).data ?? []).forEach((c: any) => cityMap.set(c.id, c.name));
  const bandMap = new Map<string, { name: string; role: string | null }[]>();
  ((bandRes as any).data ?? []).forEach((bm: any) => {
    const key = bm.user_id;
    if (!bm.bands?.name) return;
    const arr = bandMap.get(key) ?? [];
    arr.push({ name: bm.bands.name, role: bm.instrument_role || bm.role || null });
    bandMap.set(key, arr);
  });

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    username: r.username,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    bio: r.bio,
    level: r.level ?? 1,
    fame: r.fame ?? 0,
    fans: r.fans ?? 0,
    city_name: r.current_city_id ? cityMap.get(r.current_city_id) ?? null : null,
    bands: bandMap.get(r.user_id) ?? [],
  }));
}

type FriendState = "self" | "none" | "friends" | "pending_sent" | "pending_received";

export default function PlayersBrowser() {
  const { profile } = useGameData();
  const { friendships, sendRequest, acceptRequest } = useFriendships(profile?.id);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["players-browser", debounced, page, profile?.id],
    queryFn: () => fetchPlayers(debounced, page, profile?.id),
  });

  const stateMap = useMemo(() => {
    const m = new Map<string, { state: FriendState; friendshipId: string }>();
    if (!profile?.id) return m;
    for (const f of friendships) {
      const otherId = f.otherProfile?.id;
      if (!otherId) continue;
      if (f.friendship.status === "accepted") m.set(otherId, { state: "friends", friendshipId: f.friendship.id });
      else if (f.friendship.status === "pending") m.set(otherId, { state: f.isRequester ? "pending_sent" : "pending_received", friendshipId: f.friendship.id });
    }
    return m;
  }, [friendships, profile?.id]);

  const getState = (id: string): { state: FriendState; friendshipId: string } => {
    if (id === profile?.id) return { state: "self", friendshipId: "" };
    return stateMap.get(id) ?? { state: "none", friendshipId: "" };
  };

  const handleAdd = async (id: string) => {
    setBusy(true);
    try { await sendRequest(id); toast({ title: "Friend request sent" }); }
    catch (e: any) { toast({ title: "Couldn't send request", description: e?.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const handleAccept = async (fid: string) => {
    setBusy(true);
    try { await acceptRequest(fid); toast({ title: "Friend request accepted" }); }
    catch (e: any) { toast({ title: "Couldn't accept", description: e?.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const players = data ?? [];
  const selected = selectedId ? players.find((p) => p.id === selectedId) ?? null : null;
  const selectedState = selected ? getState(selected.id) : { state: "none" as FriendState, friendshipId: "" };

  return (
    <FMPageScaffold
      title="Players"
      subtitle="Browse every musician in RockMundo. Send a friend request in one click."
      icon={Users}
      backTo="/social"
      backLabel="Back to Social"
    >
      <div className="space-y-4">
        <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 backdrop-blur sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or @username…"
            />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/social/players/discover">
              <Sparkles className="mr-1 h-4 w-4" /> Advanced
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="h-40 animate-pulse bg-muted/30" /></Card>
            ))}
          </div>
        )}
        {isError && <Card role="alert"><CardContent className="p-6 text-center text-destructive">Unable to load players. Try again shortly.</CardContent></Card>}
        {!isLoading && !isError && players.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No players match “{debounced}”.</CardContent></Card>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {players.map((p) => {
            const { state, friendshipId } = getState(p.id);
            return (
              <Card key={p.id} className="transition-shadow hover:shadow-lg">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback><User className="h-7 w-7" /></AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{p.display_name || p.username}</span>
                        {p.display_name && <span className="truncate text-xs text-muted-foreground">@{p.username}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]"><Star className="mr-1 h-3 w-3" />{p.fame.toLocaleString()} fame</Badge>
                        <Badge variant="outline" className="text-[10px]"><Music className="mr-1 h-3 w-3" />Lv {p.level}</Badge>
                        {p.city_name && <Badge variant="outline" className="text-[10px]"><MapPin className="mr-1 h-3 w-3" />{p.city_name}</Badge>}
                      </div>
                    </div>
                  </div>

                  {p.bands.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.bands.slice(0, 3).map((b, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          <Music className="mr-1 h-3 w-3" />
                          {b.name}{b.role ? ` · ${b.role}` : ""}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Solo artist</p>
                  )}

                  {p.bio && <p className="line-clamp-2 text-xs text-muted-foreground">{p.bio}</p>}

                  <div className="flex flex-wrap justify-end gap-2 border-t pt-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/player/${p.id}`}>View</Link>
                    </Button>
                    {state === "none" && profile?.id && (
                      <Button size="sm" onClick={() => handleAdd(p.id)}>
                        <UserPlus className="mr-1 h-4 w-4" /> Add friend
                      </Button>
                    )}
                    {state === "pending_sent" && <Button size="sm" variant="secondary" disabled><Clock className="mr-1 h-4 w-4" /> Sent</Button>}
                    {state === "pending_received" && <Button size="sm" onClick={() => handleAccept(friendshipId)}><Check className="mr-1 h-4 w-4" /> Accept</Button>}
                    {state === "friends" && <Badge variant="default"><Check className="mr-1 h-3 w-3" /> Friends</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {players.length >= PAGE_SIZE && (
          <div className="flex justify-between">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <span className="self-center text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
        {page > 0 && players.length < PAGE_SIZE && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <span className="self-center text-sm text-muted-foreground">Page {page + 1} · End</span>
          </div>
        )}
      </div>
    </FMPageScaffold>
  );
}
