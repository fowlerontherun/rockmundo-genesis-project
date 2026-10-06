import { useEffect, useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TwaaterExploreFeed } from "@/components/twaater/TwaaterExploreFeed";
import { TrendingSection } from "@/components/twaater/TrendingSection";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterNotificationsBell } from "@/components/twaater/TwaaterNotificationsBell";
import { TwaaterMentionsFeed } from "@/components/twaater/TwaaterMentionsFeed";
import { TwaaterAccountSwitcher } from "@/components/twaater/TwaaterAccountSwitcher";
import { TwaaterLogo } from "@/components/twaater/TwaaterLogo";
import { useTwaaterBookmarks } from "@/hooks/useTwaaterBookmarks";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { TrendingHashtags } from "@/components/twaater/TrendingHashtags";
import { WhoToFollow } from "@/components/twaater/WhoToFollow";
import { TwaaterSearch } from "@/components/twaater/TwaaterSearch";
import { Home, TrendingUp, AtSign, Bookmark, Search, Users, Compass, BarChart3 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTwaaterRouteAccount } from "@/hooks/useTwaaterRouteAccount";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

const TwaaterBookmarksTab = ({ accountId }: { accountId?: string }) => {
  const { bookmarks, isLoading, error, refetch } = useTwaaterBookmarks(accountId);

  if (isLoading) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12 text-center text-muted-foreground">Loading saved Twaats…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-muted-foreground">Saved Twaats couldn't load.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-medium text-[hsl(var(--twaater-purple))] hover:underline"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
        <CardContent className="py-12"><p className="text-center text-muted-foreground">No bookmarks yet</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {bookmarks.map((bookmark: any) => (
        <TwaatCard key={bookmark.id} twaat={bookmark.twaat} viewerAccountId={accountId} />
      ))}
    </div>
  );
};


export default function Twaater() {
  const { profile } = useGameData();
  const ownerType = "persona" as const;
  const { account, isLoading: accountLoading } = useTwaaterAccount(ownerType, profile?.id);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAccountId = searchParams.get("account");
  const {
    account: displayAccount,
    isLoading: routeAccountLoading,
    requestedAccountValid,
  } = useTwaaterRouteAccount(account, requestedAccountId);

  useEffect(() => {
    if (!requestedAccountId || routeAccountLoading || requestedAccountValid) return;
    const next = new URLSearchParams(searchParams);
    next.delete("account");
    setSearchParams(next, { replace: true });
  }, [requestedAccountId, routeAccountLoading, requestedAccountValid, searchParams, setSearchParams]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setShowDesktopSidebar(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const currentAccountId = displayAccount?.id;

  const handleAccountSwitch = (accountId: string) => {
    const next = new URLSearchParams(searchParams);
    if (accountId === account?.id) next.delete("account");
    else next.set("account", accountId);
    setSearchParams(next, { replace: true });
  };

  if (!profile || accountLoading || routeAccountLoading) return (
    <FMPageScaffold title="Twaater" icon={Home} backTo="/hub/world-social">
      <div className="flex items-center justify-center py-16"><p>Loading...</p></div>
    </FMPageScaffold>
  );

  if (!account) return (
    <FMPageScaffold title="Twaater" icon={Home} backTo="/hub/world-social">
      <TwaaterAccountSetup ownerType={ownerType} ownerId={profile.id} profileUsername={profile.username} />
    </FMPageScaffold>
  );

  return (
    <FMPageScaffold title="Twaater" icon={Home} backTo="/hub/world-social">
      <div className="rounded-sm border border-fm-border overflow-hidden" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="sticky top-0 z-50 border-b px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "hsl(var(--twaater-bg))", borderColor: "hsl(var(--twaater-border))" }}>
              <TwaaterLogo size="md" />
              <div className="flex items-center gap-3">
                {currentAccountId && displayAccount?.handle && (
                  <button
                    onClick={() => navigate(`/twaater/${displayAccount.handle}`)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-[hsl(var(--twaater-purple)_/_0.1)] transition-colors text-sm"
                  >
                    <Users className="h-4 w-4 text-[hsl(var(--twaater-purple))]" />
                    <span className="font-medium">{(displayAccount?.follower_count || 0).toLocaleString()}</span>
                    <span className="text-muted-foreground hidden sm:inline">followers</span>
                  </button>
                )}
                {displayAccount && profile.user_id && (
                  <TwaaterAccountSwitcher
                    currentAccount={displayAccount}
                    userId={profile.user_id}
                    profileId={profile.id}
                    onSwitch={handleAccountSwitch}
                  />
                )}
                {currentAccountId && (
                  <button
                    onClick={() => navigate(`/twaater/analytics?account=${currentAccountId}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-[hsl(var(--twaater-purple)_/_0.1)] transition-colors text-sm"
                    title="Analytics"
                  >
                    <BarChart3 className="h-4 w-4 text-[hsl(var(--twaater-purple))]" />
                  </button>
                )}
                {currentAccountId && <TwaaterNotificationsBell accountId={currentAccountId} />}
              </div>
            </div>

            <Tabs defaultValue="feed" className="w-full">
              <TabsList className="grid w-full grid-cols-6" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
                <TabsTrigger value="feed" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Feed</span>
                </TabsTrigger>
                <TabsTrigger value="explore" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                  <Compass className="h-4 w-4" />
                  <span className="hidden sm:inline">Explore</span>
                </TabsTrigger>
                <TabsTrigger value="search" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                </TabsTrigger>
                <TabsTrigger value="trending" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Trending</span>
                </TabsTrigger>
                <TabsTrigger value="mentions" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                  <AtSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Mentions</span>
                </TabsTrigger>
                <TabsTrigger value="bookmarks" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Saved</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="mt-0">
                <div className="border-b p-4" style={{ borderColor: "hsl(var(--twaater-border))" }}>
                  {currentAccountId && <TwaaterComposer accountId={currentAccountId} />}
                </div>
                <TwaaterFeed viewerAccountId={currentAccountId} feedType="feed" />
              </TabsContent>

              <TabsContent value="explore" className="mt-0">
                <TwaaterExploreFeed viewerAccountId={currentAccountId} />
              </TabsContent>

              <TabsContent value="search" className="mt-0 p-4">
                {currentAccountId && <TwaaterSearch currentAccountId={currentAccountId} />}
              </TabsContent>

              <TabsContent value="trending" className="mt-0"><TrendingSection viewerAccountId={currentAccountId} /></TabsContent>
              <TabsContent value="mentions" className="mt-0">{currentAccountId && <TwaaterMentionsFeed accountId={currentAccountId} />}</TabsContent>

              <TabsContent value="bookmarks" className="mt-0">
                <TwaaterBookmarksTab accountId={currentAccountId} />
              </TabsContent>
            </Tabs>
          </div>

          {showDesktopSidebar && (
            <div className="hidden lg:block w-80 space-y-4 sticky top-0 h-fit pt-4">
              <TrendingHashtags />
              {currentAccountId && <WhoToFollow currentAccountId={currentAccountId} />}
            </div>
          )}
        </div>
      </div>
    </FMPageScaffold>
  );
}
