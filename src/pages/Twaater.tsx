import { useState } from "react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterFeed } from "@/hooks/useTwaats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterAccountSwitcher } from "@/components/twaater/TwaaterAccountSwitcher";
import { MessageCircle, TrendingUp, Bell } from "lucide-react";

const Twaater = () => {
  const { profile } = useGameData();
  const [selectedOwnerType, setSelectedOwnerType] = useState<"persona" | "band">("persona");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(profile?.id);

  const { account, isLoading: accountLoading } = useTwaaterAccount(
    selectedOwnerType,
    selectedOwnerId
  );

  const { feed, isLoading: feedLoading } = useTwaaterFeed(account?.id);

  if (!profile) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Twaater</CardTitle>
            <CardDescription>Create a character to join Twaater</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Twaater is RockMundo's in-game social network. Create your character to start posting
              and building your following.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accountLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading Twaater...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-6">
        <TwaaterAccountSetup
          ownerType={selectedOwnerType}
          ownerId={selectedOwnerId || ""}
          profileUsername={profile.username}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Twaater</h1>
          <p className="text-muted-foreground">
            Your voice in the music world • @{account.handle}
          </p>
        </div>
        <TwaaterAccountSwitcher
          currentAccount={account}
          onSwitch={(ownerType, ownerId) => {
            setSelectedOwnerType(ownerType);
            setSelectedOwnerId(ownerId);
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Feed */}
        <div className="lg:col-span-8 space-y-6">
          <TwaaterComposer accountId={account.id} />

          <Tabs defaultValue="feed" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="feed" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Feed
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="mentions" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Mentions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed">
              <TwaaterFeed feed={feed || []} isLoading={feedLoading} viewerAccountId={account.id} />
            </TabsContent>

            <TabsContent value="trending">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Trending posts coming soon! This will show viral twaats and hot topics.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mentions">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Mentions feed coming soon! Track who's talking about you and your music.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Followers</span>
                <span className="font-semibold text-lg">{account.follower_count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Following</span>
                <span className="font-semibold text-lg">{account.following_count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fame Score</span>
                <span className="font-semibold text-lg">{Math.round(Number(account.fame_score))}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Rewards</CardTitle>
              <CardDescription>Post to earn XP</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                First 3 twaats today: <span className="font-semibold text-foreground">+15 XP</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Linked posts: <span className="font-semibold text-foreground">+2 XP bonus</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                • Link gigs and releases to get more RSVPs and sales
              </p>
              <p className="text-muted-foreground">
                • Post consistently to build momentum
              </p>
              <p className="text-muted-foreground">
                • Engage with other artists to grow your network
              </p>
              <p className="text-muted-foreground">
                • Higher fame = more followers baseline
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Twaater;
