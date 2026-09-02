import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TwaatCard } from "@/components/twaater/TwaatCard";
import { ArrowLeft, MapPin, Calendar, Music, Users, CheckCircle2, Loader2 } from "lucide-react";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useToast } from "@/hooks/use-toast";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

const TwaaterProfileView = () => {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useGameData();

  const { account: viewerAccount } = useTwaaterAccount("persona", profile?.id);

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

  const { data: twaats, isLoading: twaatsLoading } = useQuery({
    queryKey: ["twaater-profile-twaats", profileAccount?.id],
    queryFn: async () => {
      if (!profileAccount) return [];
      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type),
          metrics:twaat_metrics(*),
          quoted_twaat:twaats!twaats_quoted_twaat_id_fkey(
            id,
            body,
            created_at,
            account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type)
          )
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

  const { data: isFollowing, isLoading: followLoading } = useQuery({
    queryKey: ["is-following", viewerAccount?.id, profileAccount?.id],
    queryFn: async () => {
      if (!viewerAccount || !profileAccount) return false;
      const { data, error } = await supabase
        .from("twaater_follows")
        .select("follower_account_id")
        .eq("follower_account_id", viewerAccount.id)
        .eq("followed_account_id", profileAccount.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!viewerAccount && !!profileAccount,
  });

  useEffect(() => {
    if (!viewerAccount?.id || !profileAccount?.id || viewerAccount.id === profileAccount.id) return;

    let cancelled = false;
    const recordView = async () => {
      const { error } = await supabase
        .from("twaater_profile_views")
        .insert({
          viewer_account_id: viewerAccount.id,
          viewed_account_id: profileAccount.id,
        });

      if (!error && !cancelled) {
        queryClient.invalidateQueries({ queryKey: ["twaater-profile", handle] });
      }
    };

    void recordView();
    return () => {
      cancelled = true;
    };
  }, [viewerAccount?.id, profileAccount?.id, handle, queryClient]);

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!viewerAccount || !profileAccount) throw new Error("Not logged in");

      if (isFollowing) {
        const { error } = await supabase
          .from("twaater_follows")
          .delete()
          .eq("follower_account_id", viewerAccount.id)
          .eq("followed_account_id", profileAccount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("twaater_follows")
          .insert({
            follower_account_id: viewerAccount.id,
            followed_account_id: profileAccount.id,
            weight: 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following", viewerAccount?.id, profileAccount?.id] });
      queryClient.invalidateQueries({ queryKey: ["twaater-profile", handle] });
      queryClient.invalidateQueries({ queryKey: ["twaater-account"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      toast({
        title: isFollowing ? "Unfollowed" : "Followed!",
        description: isFollowing
          ? `You unfollowed @${profileAccount?.handle}`
          : `You're now following @${profileAccount?.handle}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: isFollowing ? "Unfollow failed" : "Follow failed",
        description: error?.message || "We couldn't update that follow. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (accountLoading) {
    return (
      <FMPageScaffold title="Profile" icon={Users} backTo="/twaater">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!profileAccount) {
    return (
      <FMPageScaffold title="Profile" icon={Users} backTo="/twaater">
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <h2 className="text-2xl font-bold">Profile Not Found</h2>
          <p className="text-muted-foreground">@{handle} doesn't exist</p>
          <Button onClick={() => navigate("/twaater")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </FMPageScaffold>
    );
  }

  const isOwnProfile = viewerAccount?.id === profileAccount.id;

  return (
    <FMPageScaffold
      title={profileAccount.display_name}
      subtitle={`${twaats?.length || 0} twaats`}
      icon={Users}
      backTo="/twaater"
      backLabel="Back to Twaater"
    >
      <div className="rounded-sm border border-fm-border" style={{ backgroundColor: "hsl(var(--twaater-bg))" }}>
        <div className="p-4">
          <Card className="p-6" style={{ backgroundColor: "hsl(var(--twaater-card))", borderColor: "hsl(var(--twaater-border))" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold">{profileAccount.display_name}</h2>
                  {profileAccount.verified && <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--twaater-purple))" }} />}
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

            {profileAccount.bio && <p className="mb-4">{profileAccount.bio}</p>}

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

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {profileAccount.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profileAccount.location}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(profileAccount.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            </div>

            {profileAccount.engagement_score > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "hsl(var(--twaater-border))" }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Engagement Score</span>
                  <Badge variant="outline">{Math.floor(profileAccount.engagement_score)}</Badge>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="border-t" style={{ borderColor: "hsl(var(--twaater-border))" }}>
          <div className="p-4"><h3 className="font-bold text-lg mb-4">Twaats</h3></div>
          {twaatsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : twaats && twaats.length > 0 ? (
            <div>
              {twaats.map((twaat: any) => (
                <TwaatCard key={twaat.id} twaat={twaat} viewerAccountId={viewerAccount?.id || ""} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No twaats yet</div>
          )}
        </div>
      </div>
    </FMPageScaffold>
  );
};

export default TwaaterProfileView;
