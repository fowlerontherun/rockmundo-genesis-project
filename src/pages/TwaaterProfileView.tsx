import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { ArrowLeft, MapPin, Calendar, Music, Users, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useToast } from "@/hooks/use-toast";

const TwaaterProfileView = () => {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useGameData();

  // Get viewer's account (if logged in)
  const { account: viewerAccount } = useTwaaterAccount("persona", profile?.id);

  // Fetch profile account by handle
  const { data: profileAccount, isLoading: accountLoading } = useQuery({
    queryKey: ["twaater-profile", handle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaater_accounts")
        .select("*")
        .eq("handle", handle)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!handle,
  });

  // Fetch profile's twaats
  const { data: twaats, isLoading: twaatsLoading } = useQuery({
    queryKey: ["twaater-profile-twaats", profileAccount?.id],
    queryFn: async () => {
      if (!profileAccount) return [];
      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts(id, handle, display_name, verified, owner_type),
          metrics:twaat_metrics(*)
        `)
        .eq("account_id", profileAccount.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!profileAccount,
  });

  // Check if viewer is following this profile
  const { data: isFollowing, isLoading: followLoading } = useQuery({
    queryKey: ["is-following", viewerAccount?.id, profileAccount?.id],
    queryFn: async () => {
      if (!viewerAccount || !profileAccount) return false;
      const { data } = await supabase
        .from("twaater_follows")
        .select("*")
        .eq("follower_account_id", viewerAccount.id)
        .eq("followed_account_id", profileAccount.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!viewerAccount && !!profileAccount,
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!viewerAccount || !profileAccount) throw new Error("Not logged in");
      
      if (isFollowing) {
        // Unfollow
        await supabase
          .from("twaater_follows")
          .delete()
          .eq("follower_account_id", viewerAccount.id)
          .eq("followed_account_id", profileAccount.id);
          
        await supabase
          .from("twaater_accounts")
          .update({
            follower_count: Math.max(0, profileAccount.follower_count - 1)
          })
          .eq("id", profileAccount.id);
          
        await supabase
          .from("twaater_accounts")
          .update({
            following_count: Math.max(0, viewerAccount.following_count - 1)
          })
          .eq("id", viewerAccount.id);
      } else {
        // Follow
        const weight = 1.0; // Could be calculated based on follower quality
        await supabase
          .from("twaater_follows")
          .insert({
            follower_account_id: viewerAccount.id,
            followed_account_id: profileAccount.id,
            weight,
          });
          
        await supabase
          .from("twaater_accounts")
          .update({
            follower_count: profileAccount.follower_count + 1
          })
          .eq("id", profileAccount.id);
          
        await supabase
          .from("twaater_accounts")
          .update({
            following_count: viewerAccount.following_count + 1
          })
          .eq("id", viewerAccount.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-profile"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-account"] });
      toast({
        title: isFollowing ? "Unfollowed" : "Followed!",
        description: isFollowing 
          ? `You unfollowed @${profileAccount?.handle}` 
          : `You're now following @${profileAccount?.handle}`,
      });
    },
  });

  if (accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--twaater-bg))' }}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profileAccount) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'hsl(var(--twaater-bg))' }}>
        <h2 className="text-2xl font-bold">Profile Not Found</h2>
        <p className="text-muted-foreground">@{handle} doesn't exist</p>
        <Button onClick={() => navigate("/twaater")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Feed
        </Button>
      </div>
    );
  }

  const isOwnProfile = viewerAccount?.id === profileAccount.id;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--twaater-bg))' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-sm border-b p-4 flex items-center gap-4" style={{ backgroundColor: 'hsl(var(--twaater-bg) / 0.8)', borderColor: 'hsl(var(--twaater-border))' }}>
          <Button variant="ghost" size="icon" onClick={() => navigate("/twaater")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{profileAccount.display_name}</h1>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {twaats?.length || 0} twaats
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-4">
          <Card className="p-6" style={{ backgroundColor: 'hsl(var(--twaater-card))', borderColor: 'hsl(var(--twaater-border))' }}>
            {/* Profile Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold">{profileAccount.display_name}</h2>
                  {profileAccount.verified && (
                    <CheckCircle2 className="h-5 w-5" style={{ color: 'hsl(var(--twaater-purple))' }} />
                  )}
                </div>
                <p className="text-muted-foreground">@{profileAccount.handle}</p>
                <Badge variant={profileAccount.owner_type === "band" ? "default" : "secondary"} className="mt-2">
                  {profileAccount.owner_type === "band" ? <Users className="h-3 w-3 mr-1" /> : <Music className="h-3 w-3 mr-1" />}
                  {profileAccount.owner_type === "band" ? "Band" : "Artist"}
                </Badge>
              </div>
              {!isOwnProfile && viewerAccount && (
                <Button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending || followLoading}
                  variant={isFollowing ? "outline" : "default"}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              )}
            </div>

            {/* Bio */}
            {profileAccount.bio && (
              <p className="mb-4">{profileAccount.bio}</p>
            )}

            {/* Stats */}
            <div className="flex gap-6 mb-4 text-sm">
              <div>
                <span className="font-bold">{profileAccount.following_count}</span>
                <span className="ml-1 text-muted-foreground">Following</span>
              </div>
              <div>
                <span className="font-bold">{profileAccount.follower_count.toLocaleString()}</span>
                <span className="ml-1 text-muted-foreground">Followers</span>
              </div>
              <div>
                <span className="font-bold">{Math.floor(profileAccount.fame_score || 0)}</span>
                <span className="ml-1 text-muted-foreground">Fame</span>
              </div>
            </div>

            {/* Additional Info */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {profileAccount.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profileAccount.location}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(profileAccount.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Quality Rating (if visible) */}
            {profileAccount.engagement_score > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Engagement Score</span>
                  <Badge variant="outline">
                    {Math.floor(profileAccount.engagement_score)}
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Twaats */}
        <div className="border-t" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
          <div className="p-4">
            <h3 className="font-bold text-lg mb-4">Twaats</h3>
          </div>
          {twaatsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : twaats && twaats.length > 0 ? (
            <div>
              {twaats.map((twaat: any) => (
                <TwaatCard key={twaat.id} twaat={twaat} viewerAccountId={viewerAccount?.id || ""} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No twaats yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwaaterProfileView;
