import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useFanManagement } from "@/hooks/useFanManagement";
import { Users, TrendingUp, MessageCircle, Target, Calendar, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const FanManagement = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { campaigns, segments, interactions, isLoading } = useFanManagement(user?.id);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const totalReach = campaigns.reduce((sum, c) => sum + c.reach, 0);
  const totalNewFans = campaigns.reduce((sum, c) => sum + c.new_fans, 0);
  const avgEngagement =
    campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + c.engagement_rate, 0) / campaigns.length
      : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fan Management</h1>
        <p className="text-muted-foreground">Build and engage your fanbase with targeted campaigns</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReach.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">New Fans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNewFans.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average across campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns.length}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="segments">Fan Segments</TabsTrigger>
          <TabsTrigger value="interactions">Recent Interactions</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Loading campaigns...</p>
              </CardContent>
            </Card>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No campaigns yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{campaign.campaign_name}</CardTitle>
                        <CardDescription className="capitalize">{campaign.campaign_type.replace("_", " ")}</CardDescription>
                      </div>
                      <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Reach</p>
                        <p className="font-semibold">{campaign.reach.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">New Fans</p>
                        <p className="font-semibold">{campaign.new_fans.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Engagement</p>
                        <p className="font-semibold">{campaign.engagement_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Budget</p>
                        <p className="font-semibold">${campaign.budget.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                      </div>
                      <Progress value={campaign.status === "completed" ? 100 : 65} />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(campaign.start_date).toLocaleDateString()} -{" "}
                        {new Date(campaign.end_date).toLocaleDateString()}
                      </span>
                    </div>

                    {campaign.cost_per_fan && (
                      <div className="flex items-center gap-2 text-xs">
                        <DollarSign className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          Cost per fan: <span className="font-semibold">${campaign.cost_per_fan.toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          {segments.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No fan segments created yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {segments.map((segment) => (
                <Card key={segment.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{segment.segment_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fans</span>
                      <span className="font-semibold">{segment.fan_count.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Avg. Engagement</span>
                      <span className="font-semibold">{segment.avg_engagement}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Fan Interactions</CardTitle>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <p className="text-muted-foreground">No recent interactions.</p>
              ) : (
                <div className="space-y-3">
                  {interactions.slice(0, 10).map((interaction) => (
                    <div key={interaction.id} className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">
                          {interaction.interaction_type.replace("_", " ")}
                        </Badge>
                        {interaction.sentiment && (
                          <Badge
                            variant={
                              interaction.sentiment === "positive"
                                ? "default"
                                : interaction.sentiment === "negative"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {interaction.sentiment}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(interaction.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FanManagement;
