import { Bell, Loader2, MessageSquare, TrendingUp, Video } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterFeed } from "@/hooks/useTwaats";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterMentionsFeed } from "@/components/twaater/TwaaterMentionsFeed";
import { useDailyTwaatXP } from "@/hooks/useDailyTwaatXP";
import { DikCokExperience } from "@/components/dikcok/DikCokExperience";

const SocialMedia = () => {
  const { profile } = useGameData();
  const { account: twaaterAccount, isLoading: twaaterAccountLoading } =
    useTwaaterAccount("persona", profile?.id);
  const { feed: twaaterFeed, isLoading: twaaterFeedLoading } = useTwaaterFeed(
    twaaterAccount?.id,
  );
  const { twaatsPostedToday, xpEarnedToday, canEarnMore } =
    useDailyTwaatXP(twaaterAccount?.id);

  if (!profile) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Twaater</CardTitle>
            <CardDescription>
              Create your character profile to unlock social posting.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground">
            Share updates with fans and grow your following on Twaater or craft viral clips on DikCok.
          </p>
        </div>
      </div>

      <Tabs defaultValue="twaater" className="space-y-6">
        <TabsList>
          <TabsTrigger value="twaater" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Twaater
          </TabsTrigger>
          <TabsTrigger value="dikcok" className="flex items-center gap-2">
            <Video className="h-4 w-4" /> DikCok
          </TabsTrigger>
        </TabsList>

        <TabsContent value="twaater" className="space-y-6">
          {twaaterAccountLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : !twaaterAccount ? (
            <TwaaterAccountSetup
              ownerType="persona"
              ownerId={profile?.id || ""}
              profileUsername={profile?.username || ""}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 space-y-6">
                <TwaaterComposer accountId={twaaterAccount.id} />

                <Tabs defaultValue="feed" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="feed">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Feed
                    </TabsTrigger>
                    <TabsTrigger value="trending">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Trending
                    </TabsTrigger>
                    <TabsTrigger value="mentions">
                      <Bell className="h-4 w-4 mr-2" />
                      Mentions
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="feed">
                    <TwaaterFeed
                      viewerAccountId={twaaterAccount.id}
                      feedType="feed"
                    />
                  </TabsContent>

                  <TabsContent value="trending">
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-muted-foreground">
                          Trending posts coming soon! This will show viral twaats and hot topics.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="mentions">
                    <TwaaterMentionsFeed accountId={twaaterAccount.id} />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Your Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Followers</span>
                      <span className="font-semibold text-lg">
                        {twaaterAccount.follower_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Following</span>
                      <span className="font-semibold text-lg">
                        {twaaterAccount.following_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Fame Score</span>
                      <span className="font-semibold text-lg">
                        {Math.round(Number(twaaterAccount.fame_score))}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Daily XP</CardTitle>
                    <CardDescription>Post to earn rewards</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Twaats today</span>
                      <span className="font-semibold">{twaatsPostedToday}/3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">XP earned</span>
                      <span className="font-semibold text-primary">+{xpEarnedToday} XP</span>
                    </div>
                    {canEarnMore && (
                      <p className="text-xs text-muted-foreground">
                        Post {3 - twaatsPostedToday} more to reach daily cap!
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      • Link gigs and releases for +2 XP bonus
                    </p>
                    <p className="text-muted-foreground">
                      • Higher fame = more baseline followers
                    </p>
                    <p className="text-muted-foreground">
                      • Engage consistently for best outcomes
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dikcok" className="space-y-6">
          <DikCokExperience profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialMedia;
