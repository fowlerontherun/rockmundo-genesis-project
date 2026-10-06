import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageCircle, Heart, Video, Share2, TrendingUp } from "lucide-react";

export function SocialStats() {
  const { profileId } = useActiveProfile();

  const { data: stats } = useQuery({
    queryKey: ["social-stats", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      // Get Twaater account
      const { data: account } = await supabase
        .from("twaater_accounts")
        .select("id, follower_count, following_count, engagement_score")
        .eq("owner_id", profileId)
        .eq("owner_type", "persona")
        .single();

      const { data: accountTwaats } = account?.id
        ? await supabase
            .from("twaats")
            .select(`
              id,
              metrics:twaat_metrics(likes, replies, retwaats)
            `)
            .eq("account_id", account.id)
            .is("deleted_at", null)
            .is("scheduled_for", null)
        : { data: [] as any[] };

      const metrics = (accountTwaats || [])
        .map((twaat: any) => Array.isArray(twaat.metrics) ? twaat.metrics[0] : twaat.metrics)
        .filter(Boolean);
      const twaatCount = accountTwaats?.length || 0;
      const totalLikes = metrics.reduce((sum: number, m: any) => sum + (m.likes || 0), 0);
      const totalReplies = metrics.reduce((sum: number, m: any) => sum + (m.replies || 0), 0);
      const totalRetwaats = metrics.reduce((sum: number, m: any) => sum + (m.retwaats || 0), 0);

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
    enabled: !!profileId,
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
