import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Link as LinkIcon, Calendar, BadgeCheck, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TwaatCard } from "./TwaatCard";
import { useTwaaterFollow } from "@/hooks/useTwaaterFollow";
import { useTwaaterModeration } from "@/hooks/useTwaaterModeration";
import { Loader2 } from "lucide-react";

export const TwaaterProfilePage = ({ viewerAccountId }: { viewerAccountId: string }) => {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { isFollowing, follow, unfollow, isFollowPending } = useTwaaterFollow(viewerAccountId);
  const { isAccountBlocked, blockAccount, unblockAccount } = useTwaaterModeration(viewerAccountId);

  // Fetch profile data
  const { data: profile, isLoading } = useQuery({
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

  // Fetch profile twaats
  const { data: twaats } = useQuery({
    queryKey: ["twaater-profile-twaats", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type),
          metrics:twaat_metrics(*)
        `)
        .eq("account_id", profile?.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Track profile view
  const trackViewMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || profile.id === viewerAccountId) return;
      
      await supabase
        .from("twaater_profile_views")
        .insert({
          viewer_account_id: viewerAccountId,
          viewed_account_id: profile.id,
        });

      await supabase
        .from("twaater_accounts")
        .update({ profile_views: (profile.profile_views || 0) + 1 })
        .eq("id", profile.id);
    },
  });

  useEffect(() => {
    if (profile && viewerAccountId && profile.id !== viewerAccountId) {
      trackViewMutation.mutate();
    }
  }, [profile?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Profile not found</p>
            <Button onClick={() => navigate("/twaater")} className="mt-4">
              Back to Feed
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnProfile = profile.id === viewerAccountId;
  const following = isFollowing(profile.id);
  const blocked = isAccountBlocked(profile.id);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--twaater-bg))' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header with back button */}
        <div className="sticky top-0 z-10 backdrop-blur-sm border-b px-4 py-3" style={{ backgroundColor: 'hsl(var(--twaater-bg) / 0.8)', borderColor: 'hsl(var(--twaater-border))' }}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/twaater")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold">{profile.display_name}</h1>
              <p className="text-sm text-muted-foreground">{twaats?.length || 0} twaats</p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div 
          className="h-48 w-full bg-gradient-to-r from-[hsl(var(--twaater-purple))] to-[hsl(var(--primary))]"
          style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover' } : {}}
        />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex justify-between items-start -mt-16 mb-4">
            <div className="w-32 h-32 rounded-full border-4 bg-gradient-to-br from-[hsl(var(--twaater-purple))] to-[hsl(var(--primary))] flex items-center justify-center text-white text-4xl font-bold" style={{ borderColor: 'hsl(var(--twaater-bg))' }}>
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
            
            {!isOwnProfile && (
              <div className="flex gap-2 mt-4">
                {!blocked && (
                  <Button
                    variant={following ? "outline" : "default"}
                    onClick={() => following ? unfollow({ followedAccountId: profile.id }) : follow({ followedAccountId: profile.id })}
                    disabled={isFollowPending}
                  >
                    {following ? "Following" : "Follow"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (blocked) {
                      unblockAccount({ blockerAccountId: viewerAccountId, blockedAccountId: profile.id });
                    } else {
                      blockAccount({ blockerAccountId: viewerAccountId, blockedAccountId: profile.id });
                    }
                  }}
                >
                  {blocked ? "Unblock" : "Block"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{profile.display_name}</h2>
              {profile.verified && (
                <BadgeCheck className="h-5 w-5" style={{ color: 'hsl(var(--twaater-purple))' }} />
              )}
              <Badge variant="secondary" className="text-xs">
                {profile.owner_type}
              </Badge>
            </div>
            <p className="text-muted-foreground">@{profile.handle}</p>
            
            {profile.bio && <p className="mt-3">{profile.bio}</p>}
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </div>
              )}
              {profile.website_url && (
                <div className="flex items-center gap-1">
                  <LinkIcon className="h-4 w-4" />
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'hsl(var(--twaater-purple))' }}>
                    {profile.website_url.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {profile.profile_views || 0} profile views
              </div>
            </div>

            <div className="flex gap-4 mt-3">
              <div>
                <span className="font-bold">{profile.following_count || 0}</span>
                <span className="text-muted-foreground ml-1">Following</span>
              </div>
              <div>
                <span className="font-bold">{profile.follower_count || 0}</span>
                <span className="text-muted-foreground ml-1">Followers</span>
              </div>
              <div>
                <span className="font-bold">{profile.fame_score || 0}</span>
                <span className="text-muted-foreground ml-1">Fame</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="twaats" className="mt-6">
          <TabsList className="w-full justify-start border-b rounded-none px-4" style={{ borderColor: 'hsl(var(--twaater-border))' }}>
            <TabsTrigger value="twaats">Twaats</TabsTrigger>
            <TabsTrigger value="replies">Replies</TabsTrigger>
            <TabsTrigger value="likes">Likes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="twaats" className="mt-0">
            {twaats && twaats.length > 0 ? (
              <div>
                {twaats.map((twaat: any) => (
                  <TwaatCard
                    key={twaat.id}
                    twaat={twaat}
                    viewerAccountId={viewerAccountId}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No twaats yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="replies">
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Replies coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="likes">
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Liked twaats coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
