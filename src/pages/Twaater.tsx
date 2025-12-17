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
import { TwaaterAccountSwitcher } from "@/components/twaater/TwaaterAccountSwitcher";
import { TwaaterLogo } from "@/components/twaater/TwaaterLogo";
import { useTwaaterBookmarks } from "@/hooks/useTwaaterBookmarks";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { TrendingHashtags } from "@/components/twaater/TrendingHashtags";
import { Home, TrendingUp, AtSign, Bookmark } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Twaater() {
  const { profile } = useGameData();
  const [selectedOwnerType] = useState<"persona" | "band">("persona");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(profile?.id);
  const { account, isLoading: accountLoading } = useTwaaterAccount(selectedOwnerType, selectedOwnerId);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const { bookmarks } = useTwaaterBookmarks(activeAccountId || account?.id);

  // Use either the switched account or the default account
  const currentAccountId = activeAccountId || account?.id;

  // Fetch the current account details if switched
  const { data: currentAccount } = useQuery({
    queryKey: ["twaater-account-detail", currentAccountId],
    queryFn: async () => {
      if (!currentAccountId) return null;
      const { data } = await supabase
        .from("twaater_accounts")
        .select("id, owner_type, display_name, handle")
        .eq("id", currentAccountId)
        .single();
      return data;
    },
    enabled: !!currentAccountId,
  });

  const displayAccount = currentAccount || account;

  if (!profile || accountLoading) return <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}><p>Loading...</p></div>;
  if (!account) return <TwaaterAccountSetup ownerType={selectedOwnerType} ownerId={selectedOwnerId || ""} profileUsername={profile.username} />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
      <div className="max-w-4xl mx-auto flex gap-6">
        {/* Main Content */}
        <div className="flex-1 max-w-2xl">
          <div className="sticky top-0 z-50 border-b px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "hsl(var(--twaater-bg))", borderColor: "hsl(var(--twaater-border))" }}>
            <TwaaterLogo size="md" />
            <div className="flex items-center gap-2">
              {displayAccount && profile?.user_id && (
                <TwaaterAccountSwitcher
                  currentAccount={displayAccount}
                  userId={profile.user_id}
                  onSwitch={(accountId) => setActiveAccountId(accountId)}
                />
              )}
              {currentAccountId && <TwaaterNotificationsBell accountId={currentAccountId} />}
            </div>
          </div>

          <Tabs defaultValue="feed" className="w-full">
            <TabsList className="grid w-full grid-cols-4" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
              <TabsTrigger value="feed" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Feed</span>
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
                <span className="hidden sm:inline">Bookmarks</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="mt-0">
              <div className="border-b p-4" style={{ borderColor: "hsl(var(--twaater-border))" }}>
                {currentAccountId && <TwaaterComposer accountId={currentAccountId} />}
              </div>
              <TwaaterFeed viewerAccountId={currentAccountId} feedType="feed" />
            </TabsContent>

            <TabsContent value="trending" className="mt-0"><TrendingSection viewerAccountId={currentAccountId} /></TabsContent>
            <TabsContent value="mentions" className="mt-0">{currentAccountId && <TwaaterMentionsFeed accountId={currentAccountId} />}</TabsContent>
            
            <TabsContent value="bookmarks" className="mt-0">
              {!bookmarks || bookmarks.length === 0 ? (
                <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}><CardContent className="py-12"><p className="text-center text-muted-foreground">No bookmarks yet</p></CardContent></Card>
              ) : (
                <div className="space-y-2 p-2">{bookmarks.map((b: any) => <TwaatCard key={b.id} twaat={b.twaat} viewerAccountId={currentAccountId} />)}</div>
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
