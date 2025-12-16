import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterFeed } from "@/hooks/useTwaats";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TrendingSection } from "@/components/twaater/TrendingSection";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterNotificationsBell } from "@/components/twaater/TwaaterNotificationsBell";
import { TwaaterMentionsFeed } from "@/components/twaater/TwaaterMentionsFeed";
import { useTwaaterBookmarks } from "@/hooks/useTwaaterBookmarks";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { TrendingHashtags } from "@/components/twaater/TrendingHashtags";
import { Home, TrendingUp, AtSign, Bookmark } from "lucide-react";

export default function Twaater() {
  const { profile } = useGameData();
  const [selectedOwnerType] = useState<"persona" | "band">("persona");
  const [selectedOwnerId] = useState<string | undefined>(profile?.id);
  const { account, isLoading: accountLoading } = useTwaaterAccount(selectedOwnerType, selectedOwnerId);
  const { feed } = useTwaaterFeed(account?.id);
  const { bookmarks } = useTwaaterBookmarks(account?.id);

  if (!profile || accountLoading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  if (!account) return <TwaaterAccountSetup ownerType={selectedOwnerType} ownerId={selectedOwnerId || ""} profileUsername={profile.username} />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto flex gap-6">
        {/* Main Content */}
        <div className="flex-1 max-w-2xl">
          <div className="sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--twaater-purple))' }}>Twaater</h1>
            {account && <TwaaterNotificationsBell accountId={account.id} />}
          </div>

          <Tabs defaultValue="feed" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="feed" className="gap-1">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Feed</span>
              </TabsTrigger>
              <TabsTrigger value="trending" className="gap-1">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Trending</span>
              </TabsTrigger>
              <TabsTrigger value="mentions" className="gap-1">
                <AtSign className="h-4 w-4" />
                <span className="hidden sm:inline">Mentions</span>
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="gap-1">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">Bookmarks</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="mt-0">
              <div className="border-b p-4"><TwaaterComposer accountId={account.id} /></div>
              <TwaaterFeed viewerAccountId={account.id} feedType="feed" />
            </TabsContent>

            <TabsContent value="trending" className="mt-0"><TrendingSection viewerAccountId={account.id} /></TabsContent>
            <TabsContent value="mentions" className="mt-0"><TwaaterMentionsFeed accountId={account.id} /></TabsContent>
            
            <TabsContent value="bookmarks" className="mt-0">
              {!bookmarks || bookmarks.length === 0 ? (
                <Card><CardContent className="py-12"><p className="text-center text-muted-foreground">No bookmarks yet</p></CardContent></Card>
              ) : (
                <div className="space-y-4">{bookmarks.map((b: any) => <TwaatCard key={b.id} twaat={b.twaat} viewerAccountId={account.id} />)}</div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Desktop Only */}
        <div className="hidden lg:block w-80 space-y-4 sticky top-0 h-fit pt-4">
          <TrendingHashtags />
        </div>
      </div>
    </div>
  );
}