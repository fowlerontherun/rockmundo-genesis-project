import { Suspense, lazy, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import HubLayout from "@/components/hub/HubLayout";
import { socialHubNavigation } from "@/config/hubNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, MessageSquare, Compass, Inbox, Newspaper, Music2 } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { MessagesTab } from "@/features/social-hub/components/MessagesTab";
import { InvitesInbox } from "@/features/social-hub/components/InvitesInbox";
import { useIncomingInvites, useInviteRealtime } from "@/hooks/useSocialInvites";
import { useTwaaterTrending } from "@/hooks/useTwaaterTrending";

const Relationships = lazy(() => import("./Relationships"));
const PlayerSearch = lazy(() => import("./PlayerSearch"));
const BandFinder = lazy(() => import("./BandFinder"));

const Fallback = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Social page…
  </div>
);

function SocialOverview({ profileId }: { profileId: string | null | undefined }) {
  const { friendships, loading: friendshipsLoading } = useFriendships(profileId ?? null);
  const incoming = useIncomingInvites(profileId);
  const { trendingTopics, isLoading: trendingLoading } = useTwaaterTrending();

  const acceptedFriends = useMemo(() => friendships.filter((f) => f.friendship.status === "accepted"), [friendships]);
  const pendingFriendRequests = useMemo(
    () => friendships.filter((f) => f.friendship.status === "pending" && !f.isRequester),
    [friendships],
  );
  const pendingInvites = useMemo(() => (incoming.data ?? []).filter((i) => i.status === "pending"), [incoming.data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Social summary">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Friends</CardTitle><CardDescription>Accepted contacts</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{friendshipsLoading ? "…" : acceptedFriends.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Friend requests</CardTitle><CardDescription>Waiting for you</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{friendshipsLoading ? "…" : pendingFriendRequests.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Invitations</CardTitle><CardDescription>Open social invites</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{incoming.isLoading ? "…" : pendingInvites.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Twaater trends</CardTitle><CardDescription>Current topics</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{trendingLoading ? "…" : trendingTopics.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start connecting</CardTitle>
          <CardDescription>Use the existing Social tools without leaving this hub.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild><Link to="/social/players"><Compass className="mr-2 h-4 w-4" />Find players</Link></Button>
          <Button asChild variant="outline"><Link to="/social/messages"><MessageSquare className="mr-2 h-4 w-4" />Open messages</Link></Button>
          <Button asChild variant="outline"><Link to="/social/friends"><Users className="mr-2 h-4 w-4" />View friends</Link></Button>
          <Button asChild variant="outline"><Link to="/social/twaater"><Newspaper className="mr-2 h-4 w-4" />Open Twaater</Link></Button>
          <Button asChild variant="outline"><Link to="/social/recruitment"><Music2 className="mr-2 h-4 w-4" />Browse recruitment</Link></Button>
          {pendingInvites.length > 0 && <Button asChild variant="secondary"><Link to="/social/invitations"><Inbox className="mr-2 h-4 w-4" />Review invitations</Link></Button>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Requests and invitations</CardTitle><CardDescription>Friend requests and social invites are surfaced here; each workflow remains in its original system.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {pendingFriendRequests.length === 0 && pendingInvites.length === 0 ? <p className="text-sm text-muted-foreground">No pending social requests. You can search for players or browse recruitment to meet more musicians.</p> : null}
            {pendingFriendRequests.slice(0, 3).map((f) => <div key={f.friendship.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><span>{f.otherProfile?.display_name ?? f.otherProfile?.username ?? "Player"} sent a friend request.</span><Badge>Friend</Badge></div>)}
            {pendingInvites.slice(0, 3).map((i) => <div key={i.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><span>{i.kind} invitation received.</span><Badge variant="secondary">Invite</Badge></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Twaater activity</CardTitle><CardDescription>Trending topics from the existing Twaater feed.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trendingLoading ? <p className="text-sm text-muted-foreground">Loading Twaater trends…</p> : trendingTopics.length === 0 ? <p className="text-sm text-muted-foreground">No Twaater topics are trending yet. Open Twaater to post or explore.</p> : trendingTopics.slice(0, 8).map((topic) => <Badge key={topic.tag} variant="outline">{topic.tag}</Badge>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SocialHub() {
  const { pathname, search } = useLocation();
  const { profileId } = useActiveProfile();
  useInviteRealtime(profileId);

  const legacyParams = new URLSearchParams(search);
  const legacyTab = legacyParams.get("tab");
  if (pathname === "/social" && legacyTab) {
    const tabTargets: Record<string, string> = {
      friends: "/social/friends",
      messages: "/social/messages",
      discover: "/social/players",
      players: "/social/players",
      invites: "/social/invitations",
      invitations: "/social/invitations",
    };
    legacyParams.delete("tab");
    const preservedSearch = legacyParams.toString();
    const target = tabTargets[legacyTab] ?? "/social";
    return <Navigate to={`${target}${preservedSearch ? `?${preservedSearch}` : ""}`} replace />;
  }

  const child = pathname.replace(/\/$/, "").split("/")[2] ?? "overview";
  const content = child === "friends" ? <Suspense fallback={<Fallback />}><Relationships /></Suspense>
    : child === "messages" ? <MessagesTab myProfileId={profileId} />
    : child === "players" ? <Suspense fallback={<Fallback />}><PlayerSearch /></Suspense>
    : child === "invitations" ? <InvitesInbox profileId={profileId} />
    : child === "recruitment" ? <Suspense fallback={<Fallback />}><BandFinder /></Suspense>
    : <SocialOverview profileId={profileId} />;

  return (
    <HubLayout
      title="Social"
      description="Find players, maintain friendships, message contacts, follow Twaater and discover recruitment opportunities."
      icon={Users}
      overviewPath="/social"
      navigation={socialHubNavigation}
      actions={[{ label: "Find players", path: "/social/players", icon: Compass }, { label: "Messages", path: "/social/messages", icon: MessageSquare }]}
    >
      {content}
    </HubLayout>
  );
}
