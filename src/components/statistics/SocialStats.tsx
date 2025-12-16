import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageCircle, Heart, Video, Share2, TrendingUp } from "lucide-react";

export function SocialStats() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["social-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get Twaater account
      const { data: account } = await supabase
        .from("twaater_accounts")
        .select("id, follower_count, following_count, engagement_score")
        .eq("owner_id", user.id)
        .eq("owner_type", "persona")
        .single();

      // Get twaat count
      const { count: twaatCount } = await supabase
        .from("twaats")
        .select("*", { count: "exact", head: true })
        .eq("account_id", account?.id || "");

      // Get total likes received
      const { data: twaatMetrics } = await supabase
        .from("twaat_metrics")
        .select("likes, replies, retwaats");

      const totalLikes = twaatMetrics?.reduce((sum, m) => sum + ((m as any).likes || 0), 0) || 0;
      const totalReplies = twaatMetrics?.reduce((sum, m) => sum + ((m as any).replies || 0), 0) || 0;
      const totalRetwaats = twaatMetrics?.reduce((sum, m) => sum + ((m as any).retwaats || 0), 0) || 0;

      // Get DikCok stats
      const { data: videos } = await supabase
        .from("dikcok_videos")
        .select("views");

      const totalViews = videos?.reduce((sum, v) => sum + ((v as any).views || 0), 0) || 0;
      const videoLikes = 0; // likes column may not exist

      return {
        followers: account?.follower_count || 0,
        following: account?.following_count || 0,
        engagementScore: account?.engagement_score || 0,
        twaatCount: twaatCount || 0,
        totalLikes,
        totalReplies,
        totalRetwaats,
        videoViews: totalViews,
        videoLikes,
        videoCount: videos?.length || 0,
      };
    },
    enabled: !!user?.id,
  });

  if (!stats) return <div>Loading social stats...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Twaater Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.followers.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <MessageCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.twaatCount}</p>
              <p className="text-xs text-muted-foreground">Twaats</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Heart className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.totalLikes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Likes Received</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Share2 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.totalRetwaats}</p>
              <p className="text-xs text-muted-foreground">Retwaats</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm">Engagement Score</span>
              <span className="font-bold">{stats.engagementScore.toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            DikCok Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Video className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.videoCount}</p>
              <p className="text-xs text-muted-foreground">Videos</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.videoViews.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Heart className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.videoLikes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Video Likes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
