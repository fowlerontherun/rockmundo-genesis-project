import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, MessageSquare, Activity, Sparkles, Music, Mic2,
  Disc3, Plane, Search, Send, Circle, UserPlus, Shield,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { DirectMessagePanel } from "@/features/relationships/components/DirectMessagePanel";
import { FriendActivityFeed } from "@/features/relationships/components/FriendActivityFeed";
import { resolveRelationshipPairKey } from "@/features/relationships/api";
import { cn } from "@/lib/utils";
import type { DecoratedFriendship } from "@/features/relationships/types";

const QUICK_INVITES = [
  { icon: Music, label: "Jam", path: "/jam-sessions" },
  { icon: Mic2, label: "Co-write", path: "/songwriting" },
  { icon: Disc3, label: "Studio", path: "/recording" },
  { icon: Plane, label: "Tour", path: "/tour-manager" },
];

function isOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export default function SocialHub() {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const { friendships, loading } = useFriendships(profileId ?? null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DecoratedFriendship | null>(null);

  const accepted = useMemo(
    () => friendships.filter((f) => f.friendship.status === "accepted"),
    [friendships],
  );
  const pending = useMemo(
    () => friendships.filter((f) => f.friendship.status === "pending" && !f.isRequester),
    [friendships],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accepted;
    return accepted.filter((f) =>
      (f.otherProfile?.display_name ?? f.otherProfile?.username ?? "")
        .toLowerCase()
        .includes(q),
    );
  }, [accepted, search]);

  const onlineCount = accepted.filter((f) => isOnline((f.otherProfile as any)?.last_active_at)).length;

  const dmChannel = selected && profile?.id && selected.otherProfile?.id
    ? resolveRelationshipPairKey(profile.id, selected.otherProfile.id)
    : null;

  return (
    <PageLayout>
      <PageHeader
        icon={Users}
        title="Social Hub"
        description="Friends, activity, and messages — all in one place."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Circle className="h-2 w-2 fill-success text-success" />
              {onlineCount} online
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/players/search">
                <UserPlus className="h-4 w-4 mr-1" /> Find players
              </Link>
            </Button>
          </div>
        }
      />

      {/* Quick invite strip */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {QUICK_INVITES.map((q) => (
          <Button
            key={q.label}
            asChild
            variant="outline"
            size="sm"
            className="h-14 flex-col gap-1"
          >
            <Link to={q.path}>
              <q.icon className="h-4 w-4" />
              <span className="text-[10px]">{q.label}</span>
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[280px_1fr_320px] gap-3">
        {/* COL 1: Friends */}
        <Card className="lg:order-1 order-1 flex flex-col h-[calc(100vh-260px)] min-h-[400px]">
          <CardHeader className="p-3 pb-2 space-y-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Friends ({accepted.length})
            </CardTitle>
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-7 text-xs pl-7"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <Tabs defaultValue="online" className="h-full flex flex-col">
              <TabsList className="grid grid-cols-3 mx-3 h-8">
                <TabsTrigger value="online" className="text-[10px]">Online</TabsTrigger>
                <TabsTrigger value="all" className="text-[10px]">All</TabsTrigger>
                <TabsTrigger value="pending" className="text-[10px]">
                  Reqs {pending.length > 0 && <span className="ml-1 text-primary">{pending.length}</span>}
                </TabsTrigger>
              </TabsList>
              <ScrollArea className="flex-1 mt-2">
                <TabsContent value="online" className="m-0 px-1.5">
                  <FriendList
                    items={filtered.filter((f) => isOnline((f.otherProfile as any)?.last_active_at))}
                    selectedId={selected?.friendship.id}
                    onSelect={setSelected}
                    loading={loading}
                    emptyText="No friends online"
                  />
                </TabsContent>
                <TabsContent value="all" className="m-0 px-1.5">
                  <FriendList
                    items={filtered}
                    selectedId={selected?.friendship.id}
                    onSelect={setSelected}
                    loading={loading}
                    emptyText="No friends yet"
                  />
                </TabsContent>
                <TabsContent value="pending" className="m-0 px-1.5">
                  <FriendList
                    items={pending}
                    selectedId={selected?.friendship.id}
                    onSelect={setSelected}
                    loading={loading}
                    emptyText="No pending requests"
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>

        {/* COL 2: DM / detail */}
        <Card className="lg:order-2 order-3 flex flex-col h-[calc(100vh-260px)] min-h-[400px]">
          {selected && dmChannel && user?.id ? (
            <DirectMessagePanel
              channel={dmChannel}
              currentUserId={user.id}
              otherDisplayName={
                selected.otherProfile?.display_name ??
                selected.otherProfile?.username ??
                "Friend"
              }
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-2">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a friend to message them.</p>
              <p className="text-xs">Or jump into a public space to find people now.</p>
              <div className="flex gap-2 mt-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/jam-sessions">Open Jam Lobby</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/nightclubs">Nightclubs</Link>
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* COL 3: Activity feed */}
        <Card className="lg:order-3 order-2 flex flex-col h-[calc(100vh-260px)] min-h-[400px]">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full px-3">
              <FriendActivityFeed />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function FriendList({
  items,
  selectedId,
  onSelect,
  loading,
  emptyText,
}: {
  items: DecoratedFriendship[];
  selectedId?: string;
  onSelect: (f: DecoratedFriendship) => void;
  loading: boolean;
  emptyText: string;
}) {
  if (loading) {
    return <p className="text-xs text-muted-foreground p-3">Loading…</p>;
  }
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground p-3">{emptyText}</p>;
  }
  return (
    <ul className="space-y-0.5">
      {items.map((f) => {
        const name = f.otherProfile?.display_name ?? f.otherProfile?.username ?? "Friend";
        const online = isOnline((f.otherProfile as any)?.last_active_at);
        return (
          <li key={f.friendship.id}>
            <button
              type="button"
              onClick={() => onSelect(f)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted/60 transition-colors",
                selectedId === f.friendship.id && "bg-muted",
              )}
            >
              <div className="relative">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={(f.otherProfile as any)?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-background" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {online ? "Online" : "Offline"}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
