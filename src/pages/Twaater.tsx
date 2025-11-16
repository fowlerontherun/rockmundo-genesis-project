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
import { TwaaterSearch } from "@/components/twaater/TwaaterSearch";
import { SuggestedAccounts } from "@/components/twaater/SuggestedAccounts";
import { TrendingSection } from "@/components/twaater/TrendingSection";
import { TwaaterProfileEditDialog } from "@/components/twaater/TwaaterProfileEditDialog";
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
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--twaater-bg))' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'hsl(var(--twaater-bg) / 0.8)', borderColor: 'hsl(var(--twaater-border))' }}>
          <h1 className="text-xl font-bold">Twaater</h1>
          <TwaaterAccountSwitcher
            currentAccount={account}
            onSwitch={(ownerType, ownerId) => {
              setSelectedOwnerType(ownerType);
              setSelectedOwnerId(ownerId);
            }}
          />
        </div>

        <div className="flex">
          {/* Sidebar - Hidden on mobile */}
          <div className="hidden lg:block w-64 xl:w-80 border-r min-h-screen p-4" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
            <div className="space-y-4 sticky top-20">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'hsl(var(--twaater-card))' }}>
                <div className="mb-2 cursor-pointer" onClick={() => window.location.href = `/twaater/${account.handle}`}>
                  <div className="font-bold text-lg">{account.display_name}</div>
                  <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>@{account.handle}</div>
                </div>
                <div className="flex gap-4 text-sm mt-3">
                  <div>
                    <span className="font-bold">{account.following_count}</span>
                    <span className="ml-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Following</span>
                  </div>
                  <div>
                    <span className="font-bold">{account.follower_count.toLocaleString()}</span>
                    <span className="ml-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Followers</span>
                  </div>
                </div>
                <div className="mt-3">
                  <TwaaterProfileEditDialog account={account} ownerType={selectedOwnerType} ownerId={selectedOwnerId || ""} />
                </div>
              </div>

              <TwaaterSearch currentAccountId={account.id} />

              <div className="rounded-xl p-4" style={{ backgroundColor: 'hsl(var(--twaater-card))' }}>
                <div className="font-bold mb-3">Daily XP</div>
                <div className="space-y-2 text-sm">
                  <div style={{ color: 'hsl(var(--muted-foreground))' }}>First 3 twaats: <span className="font-semibold" style={{ color: 'hsl(var(--twaater-purple))' }}>+15 XP</span></div>
                  <div style={{ color: 'hsl(var(--muted-foreground))' }}>Linked posts: <span className="font-semibold" style={{ color: 'hsl(var(--twaater-purple))' }}>+2 XP</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Feed */}
          <div className="flex-1 max-w-2xl border-r" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
            <div className="border-b" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
              <Tabs defaultValue="feed" className="w-full">
                <TabsList className="w-full grid grid-cols-3 rounded-none h-auto bg-transparent border-b-0">
                  <TabsTrigger 
                    value="feed" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--twaater-purple))] data-[state=active]:bg-transparent hover:bg-[hsl(var(--twaater-hover))] py-4"
                  >
                    <MessageCircle className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Feed</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="trending"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--twaater-purple))] data-[state=active]:bg-transparent hover:bg-[hsl(var(--twaater-hover))] py-4"
                  >
                    <TrendingUp className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Trending</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="mentions"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(var(--twaater-purple))] data-[state=active]:bg-transparent hover:bg-[hsl(var(--twaater-hover))] py-4"
                  >
                    <Bell className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Mentions</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="feed" className="mt-0">
                  <div className="border-b p-4" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
                    <TwaaterComposer accountId={account.id} />
                  </div>
                  <TwaaterFeed feed={feed || []} isLoading={feedLoading} viewerAccountId={account.id} />
                </TabsContent>

                <TabsContent value="trending" className="mt-0">
                  <TrendingSection viewerAccountId={account.id} />
                </TabsContent>

                <TabsContent value="mentions" className="mt-0">
                  {/* Mentions feed implementation would go here using TwaaterMentionsFeed */}
                  <div className="p-8 text-center space-y-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <Bell className="h-12 w-12 mx-auto opacity-50" />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Mentions Coming Soon</h3>
                      <p className="text-sm">Get notified when other players mention you in their twaats.</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right Sidebar - Hidden on mobile */}
          <div className="hidden xl:block w-80 p-4">
            <div className="space-y-4 sticky top-20">
              <SuggestedAccounts accountId={account.id} />

              <div className="rounded-xl p-4" style={{ backgroundColor: 'hsl(var(--twaater-card))' }}>
                <div className="font-bold mb-3">Tips for Success</div>
                <div className="space-y-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <div>• Link gigs and releases for more engagement</div>
                  <div>• Post consistently to build momentum</div>
                  <div>• Engage with other artists</div>
                  <div>• Higher fame = more followers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Twaater;
