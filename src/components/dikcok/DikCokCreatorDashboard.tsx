import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, Eye, Award, Flame, DollarSign, BarChart3, Star } from "lucide-react";

interface DikCokCreatorDashboardProps {
  band: {
    id: string;
    name: string;
    fame?: number;
    total_fans?: number;
  };
  videos: any[];
}

export const DikCokCreatorDashboard = ({ band, videos = [] }: DikCokCreatorDashboardProps) => {
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalHype = videos.reduce((sum, v) => sum + (v.hype_gained || 0), 0);
  const totalFans = videos.reduce((sum, v) => sum + (v.fan_gain || 0), 0);
  const avgEngagement = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;
  const estimatedRevenue = videos.reduce((sum, v) => {
    const views = Number(v.views || 0);
    const fame = Number(band.fame || 0);
    return sum + views * (0.0012 + fame / 500000);
  }, 0);

  // Top performing videos
  const topVideos = [...videos]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  // Creator tier based on total views
  const getTier = () => {
    if (totalViews >= 1000000) return { label: "Diamond Creator", color: "text-purple-500", icon: "💎", progress: 100 };
    if (totalViews >= 500000) return { label: "Platinum Creator", color: "text-foreground", icon: "🏆", progress: (totalViews / 1000000) * 100 };
    if (totalViews >= 100000) return { label: "Gold Creator", color: "text-yellow-500", icon: "🥇", progress: (totalViews / 500000) * 100 };
    if (totalViews >= 10000) return { label: "Silver Creator", color: "text-muted-foreground", icon: "🥈", progress: (totalViews / 100000) * 100 };
    if (totalViews >= 1000) return { label: "Bronze Creator", color: "text-orange-600", icon: "🥉", progress: (totalViews / 10000) * 100 };
    return { label: "Newcomer", color: "text-muted-foreground", icon: "🌱", progress: (totalViews / 1000) * 100 };
  };

  const tier = getTier();

  // Engagement rate (hype per view)
  const engagementRate = totalViews > 0 ? ((totalHype / totalViews) * 100).toFixed(1) : "0.0";

  // Growth trend (compare first half vs second half of videos)
  const midpoint = Math.floor(videos.length / 2);
  const recentViews = videos.slice(0, midpoint).reduce((s, v) => s + (v.views || 0), 0);
  const olderViews = videos.slice(midpoint).reduce((s, v) => s + (v.views || 0), 0);
  const growthTrend = olderViews > 0 ? ((recentViews - olderViews) / olderViews * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      {/* Creator Tier */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{tier.icon}</span>
              <div>
                <h3 className={`font-bold ${tier.color}`}>{tier.label}</h3>
                <p className="text-xs text-muted-foreground">{band.name} on DikCok</p>
              </div>
            </div>
            <Badge variant="outline">{videos.length} videos</Badge>
          </div>
          <Progress value={Math.min(tier.progress, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {totalViews.toLocaleString()} / {totalViews >= 1000000 ? "MAX" : (totalViews >= 500000 ? "1M" : totalViews >= 100000 ? "500K" : totalViews >= 10000 ? "100K" : totalViews >= 1000 ? "10K" : "1K")} views to next tier
          </p>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Views</span>
            </div>
            <p className="text-xl font-bold">{totalViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">~{avgEngagement.toLocaleString()} avg/video</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Engagement Rate</span>
            </div>
            <p className="text-xl font-bold">{engagementRate}%</p>
            <p className="text-xs text-muted-foreground">Hype-to-view ratio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Growth</span>
            </div>
            <p className={`text-xl font-bold ${Number(growthTrend) > 0 ? "text-green-500" : Number(growthTrend) < 0 ? "text-destructive" : ""}`}>
              {Number(growthTrend) > 0 ? "+" : ""}{growthTrend}%
            </p>
            <p className="text-xs text-muted-foreground">Recent vs earlier</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Est. Revenue</span>
            </div>
            <p className="text-xl font-bold">${estimatedRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">From video views</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Videos */}
      {topVideos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Top Performing Videos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topVideos.map((video, idx) => (
              <div key={video.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{video.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {video.video_type?.name || video.video_type_id} · {video.video_type?.category || ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{(video.views || 0).toLocaleString()} views</p>
                  <p className="text-xs text-muted-foreground">+{video.hype_gained || 0} hype</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fan Conversion Metrics */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Fan Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">+{totalFans.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mb-2">Fans gained from DikCok</p>
            <Progress 
              value={totalViews > 0 ? Math.min((totalFans / totalViews) * 1000, 100) : 0} 
              className="h-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              {totalViews > 0 ? ((totalFans / totalViews) * 100).toFixed(2) : "0.00"}% conversion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Content Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalHype.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mb-2">Total hype generated</p>
            <Progress 
              value={videos.length > 0 ? Math.min((totalHype / (videos.length * 100)) * 100, 100) : 0} 
              className="h-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              ~{videos.length > 0 ? Math.round(totalHype / videos.length) : 0} hype avg per video
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
