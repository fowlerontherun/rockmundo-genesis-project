import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterFeed } from "@/hooks/useTwaats";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TwaaterSearch } from "@/components/twaater/TwaaterSearch";
import { TrendingSection } from "@/components/twaater/TrendingSection";
import { SuggestedAccounts } from "@/components/twaater/SuggestedAccounts";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterNotificationsBell } from "@/components/twaater/TwaaterNotificationsBell";
import { TwaaterMentionsFeed } from "@/components/twaater/TwaaterMentionsFeed";
import { useTwaaterBookmarks } from "@/hooks/useTwaaterBookmarks";
import { TwaatCard } from "@/components/twaater/TwaatCard";

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
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 z-50 bg-background border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Twaater</h1>
          {account && <TwaaterNotificationsBell accountId={account.id} />}
        </div>

        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="mentions">Mentions</TabsTrigger>
            <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
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
    </div>
  );
}