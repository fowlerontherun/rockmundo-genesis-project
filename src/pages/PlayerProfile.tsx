import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePlayerConnection } from "@/hooks/usePlayerConnections";
import { respondToFriendship } from "@/integrations/supabase/playerConnections";
import {
  User, Music, Calendar, MapPin, Star, Clock, TrendingUp, Users, UserPlus, UserMinus, AlertCircle, Edit
} from "lucide-react";
import { format } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { getPublicProfileDetail } from "@/services/publicProfileDetail";
import { PlayerProfileHeader, FutureProfileActions } from "@/components/player-profile/PlayerProfileHeader";
import { ProfileInfoCard, BandProfileCard, EmploymentProfileCard, OpenStatusBadges } from "@/components/player-profile/ProfileCards";
import { mergePresenceProfiles } from "@/services/presenceService";

export default function PlayerProfile() {
  const { playerId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser, isLoading: isCurrentUserLoading } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("user_id", user.id)
        .single();
      return profile;
    },
  });

  const { data: profile, isLoading, isError, error } = useQuery({
    queryKey: ["public-player-profile-detail", playerId, currentUser?.id],
    queryFn: () => getPublicProfileDetail(playerId, currentUser?.id),
    enabled: !!playerId && !!currentUser?.id,
    retry: false,
  });

  // Friendship status
  const { data: profilePresence } = useQuery({
    queryKey: ["player-profile-presence", playerId],
    queryFn: async () => {
      if (!playerId || !profile) return null;
      const { data } = await supabase.from("profile_activity_statuses").select("profile_id,activity_type,status,started_at,updated_at,ends_at,metadata").eq("profile_id", playerId).is("completed_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return mergePresenceProfiles([{ id: profile.id, user_id: profile.user_id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, city_name: profile.city_name, updated_at: profile.created_at } as any], data ? [data as any] : [], new Set())[0];
    },
    enabled: !!playerId && !!profile,
  });

  const connection = usePlayerConnection(playerId);

  const { data: friendship } = useQuery({
    queryKey: ["friendship-status", currentUser?.id, playerId],
    queryFn: async () => {
      if (!currentUser?.id || !playerId || currentUser.id === playerId) return null;
      const { data } = await supabase
        .from("friendships")
        .select("id, status, requestor_id, addressee_id")
        .or(`and(requestor_id.eq.${currentUser.id},addressee_id.eq.${playerId}),and(requestor_id.eq.${playerId},addressee_id.eq.${currentUser.id})`)
        .maybeSingle();
      return data;
    },
    enabled: !!currentUser?.id && !!playerId && currentUser?.id !== playerId,
  });

  // Send friend request
  const sendRequest = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id || !playerId) throw new Error("Missing IDs");
      await connection.send.mutateAsync();
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
      queryClient.invalidateQueries({ queryKey: ["player-connection"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Remove friendship
  const removeFriend = useMutation({
    mutationFn: async () => {
      if (!friendship?.id) throw new Error("No friendship");
      await respondToFriendship(friendship.id, "removed");
    },
    onSuccess: () => {
      toast({ title: "Friend removed" });
      queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
      queryClient.invalidateQueries({ queryKey: ["player-connection"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Accept friend request
  const acceptRequest = useMutation({
    mutationFn: async () => {
      if (!friendship?.id) throw new Error("No friendship");
      await respondToFriendship(friendship.id, "accepted");
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted!" });
      queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
      queryClient.invalidateQueries({ queryKey: ["player-connection"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isCurrentUserLoading || isLoading) {
    return (
      <FMPageScaffold title="Player Profile" icon={User} backTo="/players/search">
        <Card><CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading profile...</p>
        </CardContent></Card>
      </FMPageScaffold>
    );
  }

  if (!currentUser) {
    return (
      <FMPageScaffold title="Player Profile" icon={User} backTo="/players/search">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center" role="alert" aria-live="polite">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium">Sign in required</p>
              <p className="text-sm text-muted-foreground">Sign in with an active player profile to view player profiles.</p>
            </div>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (isError) {
    return (
      <FMPageScaffold title="Player Profile" icon={User} backTo="/players/search">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center" role="alert" aria-live="polite">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium">Profile unavailable</p>
              <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "This player profile is not available."}</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/players/search">Back to player search</Link>
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (!profile) {
    return (
      <FMPageScaffold title="Player Profile" icon={User} backTo="/players/search">
        <Card><CardContent className="p-6">
          <p className="text-center text-muted-foreground">Player not found.</p>
        </CardContent></Card>
      </FMPageScaffold>
    );
  }

  const isOwnProfile = currentUser?.id === playerId;
  const isFriend = friendship?.status === "accepted";
  const isPendingSent = friendship?.status === "pending" && friendship?.requestor_id === currentUser?.id;
  const isPendingReceived = friendship?.status === "pending" && friendship?.addressee_id === currentUser?.id;

  const statItems = [
    { icon: Star, label: "Level", value: profile.level || 1 },
    { icon: TrendingUp, label: "Fame", value: (profile.fame || 0).toLocaleString() },
    { icon: Users, label: "Fans", value: (profile.fans || 0).toLocaleString() },
    { icon: Music, label: "Bands", value: profile.bands.length.toLocaleString() },
  ];

  return (
    <FMPageScaffold title={profile.display_name || profile.username || "Player"} icon={User} backTo="/players/search">

      <PlayerProfileHeader
        name={profile.display_name || profile.username}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        cityName={profile.city_name}
        currentBand={profile.bands[0] ? { id: profile.bands[0].id, name: profile.bands[0].name } : null}
        mainRole={profile.social_profile?.preferred_roles?.[0] || profile.bands[0]?.instrument_role}
        fame={profile.fame}
        careerLevel={profile.level}
        presence={profilePresence?.presence}
        isOwnProfile={isOwnProfile}
        actions={isOwnProfile ? (
          <Button asChild size="sm"><Link to="/character/profile/edit"><Edit className="mr-1 h-4 w-4" />Edit profile</Link></Button>
        ) : (
          <>
            {(connection.data === "not_connected" || !friendship) && <Button size="sm" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending || connection.send.isPending}><UserPlus className="h-4 w-4 mr-1" /> Add Friend</Button>}
            {(connection.data === "outgoing_pending" || isPendingSent) && <Button size="sm" variant="secondary" disabled><Clock className="h-4 w-4 mr-1" /> Request Sent</Button>}
            {(connection.data === "incoming_pending" || isPendingReceived) && <><Button size="sm" onClick={() => acceptRequest.mutate()} disabled={acceptRequest.isPending}><UserPlus className="h-4 w-4 mr-1" /> Accept Request</Button><Button size="sm" variant="outline" onClick={() => friendship?.id && respondToFriendship(friendship.id, "declined").then(() => queryClient.invalidateQueries({ queryKey: ["friendship-status"] }))}>Decline</Button></>}
            {(connection.data === "friends" || isFriend) && <Button size="sm" variant="destructive" onClick={() => window.confirm("Remove this friend? Friends-only profile access will be lost.") && removeFriend.mutate()} disabled={removeFriend.isPending}><UserMinus className="h-4 w-4 mr-1" /> Remove Friend</Button>}
            {connection.data === "restricted" && <Button size="sm" variant="secondary" disabled>This player is not accepting requests</Button>}
            <FutureProfileActions />
          </>
        )}
      />

      {profile.social_profile?.status_message && <Card><CardContent className="p-4 text-sm font-medium">{profile.social_profile.status_message}</CardContent></Card>}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statItems.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-3 flex items-center gap-3">
                <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4">
          {/* Bands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Music className="h-5 w-5" /> Bands
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!profile.bands || profile.bands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not a member of any bands yet.</p>
              ) : (
                <div className="space-y-4">
                  {profile.bands.map((membership: any, idx: number) => (
                    <div key={membership.id}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/band/${membership.id}`} className="font-medium hover:underline">
                              {membership.name}
                            </Link>
                            {membership.genre && (
                              <Badge variant="secondary">{membership.genre}</Badge>
                            )}
                            <Badge variant={membership.role === "leader" ? "default" : "outline"}>
                              {membership.role}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {membership.instrument_role}
                            {membership.vocal_role && ` / ${membership.vocal_role}`}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Fame: {membership.fame || 0}</span>
                            <span>Chemistry: {membership.chemistry_level || 0}</span>
                          </div>
                        </div>
                        {membership.joined_at && (
                          <div className="text-xs text-muted-foreground">
                            Joined {format(new Date(membership.joined_at), "MMM yyyy")}
                          </div>
                        )}
                      </div>
                      {idx < profile.bands.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <ProfileInfoCard title="Biography" icon={User}>
              {profile.social_profile?.biography || profile.bio ? <p className="whitespace-pre-wrap text-sm">{profile.social_profile?.biography || profile.bio}</p> : <p className="text-sm text-muted-foreground">No biography has been shared.</p>}
            </ProfileInfoCard>
            <ProfileInfoCard title="Musical Identity" icon={Music}>
              {profile.social_profile?.show_skills === false || profile.social_profile?.skill_visibility === 'hidden' ? <p className="text-sm text-muted-foreground">Skill information is hidden.</p> : <div className="space-y-2 text-sm">
                <p><span className="font-medium">Primary instrument:</span> {profile.social_profile?.primary_instrument || 'Not shared'}</p>
                <p><span className="font-medium">Secondary:</span> {profile.social_profile?.secondary_instruments?.join(', ') || 'Not shared'}</p>
                <p><span className="font-medium">Genres:</span> {profile.social_profile?.preferred_genres?.join(', ') || 'Not shared'}</p>
                <p><span className="font-medium">Vocals:</span> {profile.social_profile?.vocal_capability || 'Not shared'}</p>
                <p className="text-muted-foreground">Proficiency is shown as broad public badges; hidden exact skill values are not exposed.</p>
              </div>}
            </ProfileInfoCard>
            <ProfileInfoCard title="Availability" icon={Users}><OpenStatusBadges profile={profile.social_profile} /></ProfileInfoCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ProfileInfoCard title="Current band" icon={Music}>
              {profile.bands[0] ? <BandProfileCard band={profile.bands[0]} /> : <p className="text-sm text-muted-foreground">No current band listed.</p>}
            </ProfileInfoCard>
            <ProfileInfoCard title="Employment"><EmploymentProfileCard employer={profile.career_summary?.current_employer} jobTitle={profile.career_summary?.current_job} /></ProfileInfoCard>
          </div>

          <ProfileInfoCard title="Career Summary" icon={TrendingUp}>
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <p>Bands joined: {profile.career_summary?.bands_joined ?? profile.bands.length}</p>
              <p>Gigs performed: {profile.career_summary?.gigs_performed ?? 'Not available'}</p>
              <p>Songs written: {profile.career_summary?.songs_written ?? 'Not available'}</p>
              <p>Recordings released: {profile.career_summary?.recordings_released ?? 'Not available'}</p>
              <p>Albums released: {profile.career_summary?.albums_released ?? 'Not available'}</p>
              <p>Awards: {profile.career_summary?.awards ?? 'Not available'}</p>
            </div>
          </ProfileInfoCard>

          <ProfileInfoCard title="Achievements and badges" icon={Star}>
            {profile.badges?.length ? <div className="flex flex-wrap gap-2">{profile.badges.map((badge: any) => <Badge key={badge.badge_key || badge.name}>{badge.label || badge.name}</Badge>)}</div> : <p className="text-sm text-muted-foreground">No public badges yet.</p>}
          </ProfileInfoCard>

          <ProfileInfoCard title="Recent public activity" icon={Clock}>
            {profile.public_activity?.length ? <div className="space-y-2">{profile.public_activity.slice(0, 5).map((item: any) => <p key={item.id || item.created_at} className="text-sm">{item.summary}</p>)}</div> : <p className="text-sm text-muted-foreground">No public activity to show.</p>}
          </ProfileInfoCard>

          {profile.city_name && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" /> Public Location
              </CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{profile.city_name}</p>
                <p className="text-sm text-muted-foreground">Shown because this player allows their city to appear on public profiles.</p>
              </CardContent>
            </Card>
          )}
      </div>
    </FMPageScaffold>
  );
}