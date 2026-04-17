import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  User, Music, Calendar, MapPin, Heart, Zap, Star, Trophy,
  Crown, Shield, Flame, Clock, TrendingUp, Users, UserPlus, UserMinus, Send
} from "lucide-react";
import { format } from "date-fns";
import { NominateButton } from "@/components/elections/NominateButton";

const INSTRUMENTS = ['Guitar', 'Bass', 'Drums', 'Keyboard', 'Other'];
const VOCAL_ROLES = ['Lead Vocals', 'Backing Vocals', 'None'];

export default function PlayerProfile() {
  const { playerId } = useParams();
  const [activeTab, setActiveTab] = useState("profile");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedBand, setSelectedBand] = useState("");
  const [instrumentRole, setInstrumentRole] = useState("Guitar");
  const [vocalRole, setVocalRole] = useState("None");
  const [inviteMessage, setInviteMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser } = useQuery({
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

  const { data: profile, isLoading } = useQuery({
    queryKey: ["player-profile-full", playerId],
    queryFn: async () => {
      if (!playerId) throw new Error("No player ID");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(`
          id, user_id, username, display_name, avatar_url, bio, created_at,
          age, gender, level, fame, fans, health, energy, experience,
          total_hours_played, is_vip, generation_number, current_city_id,
          is_imprisoned, is_traveling, current_activity
        `)
        .eq("id", playerId)
        .single();

      if (profileError) throw profileError;
      if (!profileData) return null;

      const [cityResult, membershipsResult, reputationResult] = await Promise.all([
        profileData.current_city_id
          ? supabase.from("cities").select("id, name, country, music_scene").eq("id", profileData.current_city_id).single()
          : Promise.resolve({ data: null }),
        supabase
          .from("band_members")
          .select(`
            id, instrument_role, vocal_role, role, joined_at, band_id,
            bands!band_members_band_id_fkey(id, name, genre, fame, chemistry_level)
          `)
          .eq("user_id", profileData.user_id),
        supabase
          .from("player_attributes")
          .select("charisma, stage_presence, creative_insight, crowd_engagement, musical_ability, musicality, physical_endurance, looks, mental_focus, rhythm_sense, social_reach, technical_mastery, vocal_talent")
          .eq("profile_id", profileData.id)
          .maybeSingle(),
      ]);

      return {
        ...profileData,
        city: cityResult.data,
        band_members: membershipsResult.data || [],
        attributes: reputationResult.data,
      };
    },
    enabled: !!playerId,
  });

  // Friendship status
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

  // Current user's bands (where they are leader/Founder) for invite
  const { data: myBands } = useQuery({
    queryKey: ["my-leader-bands", currentUser?.user_id],
    queryFn: async () => {
      if (!currentUser?.user_id) return [];
      const { data } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(id, name)")
        .eq("user_id", currentUser.user_id)
        .in("role", ["leader", "Founder"]);
      return data?.map((m: any) => m.bands).filter(Boolean) || [];
    },
    enabled: !!currentUser?.user_id,
  });

  // Send friend request
  const sendRequest = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id || !playerId) throw new Error("Missing IDs");
      const { error } = await supabase.from("friendships").insert({
        requestor_id: currentUser.id,
        addressee_id: playerId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Remove friendship
  const removeFriend = useMutation({
    mutationFn: async () => {
      if (!friendship?.id) throw new Error("No friendship");
      const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Friend removed" });
      queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Accept friend request
  const acceptRequest = useMutation({
    mutationFn: async () => {
      if (!friendship?.id) throw new Error("No friendship");
      const { error } = await supabase.from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", friendship.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted!" });
      queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Invite to band
  const inviteToBand = useMutation({
    mutationFn: async () => {
      if (!currentUser?.user_id || !profile?.user_id || !selectedBand) throw new Error("Missing data");
      const { error } = await supabase.from("band_invitations").insert({
        band_id: selectedBand,
        inviter_user_id: currentUser.user_id,
        invited_user_id: profile.user_id,
        instrument_role: instrumentRole,
        vocal_role: vocalRole === "None" ? null : vocalRole,
        message: inviteMessage || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Band invitation sent!" });
      setInviteOpen(false);
      setSelectedBand("");
      setInstrumentRole("Guitar");
      setVocalRole("None");
      setInviteMessage("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Skills query
  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ["player-skills", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data: progressData } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level, current_xp, required_xp, last_practiced_at")
        .eq("profile_id", playerId)
        .order("current_level", { ascending: false });
      if (!progressData || progressData.length === 0) return [];
      const slugs = progressData.map(s => s.skill_slug);
      const { data: definitions } = await supabase
        .from("skill_definitions")
        .select("slug, display_name")
        .in("slug", slugs);
      const nameMap = new Map(definitions?.map(d => [d.slug, d.display_name]) || []);
      return progressData.map(s => ({
        ...s,
        display_name: nameMap.get(s.skill_slug) || s.skill_slug.replace(/_/g, " "),
      }));
    },
    enabled: !!playerId && activeTab === "skills",
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Card><CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading profile...</p>
        </CardContent></Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Card><CardContent className="p-6">
          <p className="text-center text-muted-foreground">Player not found.</p>
        </CardContent></Card>
      </div>
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
    { icon: Clock, label: "Hours Played", value: (profile.total_hours_played || 0).toLocaleString() },
  ];

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      {/* Hero Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24 border-2 border-primary/30 flex-shrink-0">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">
                      {profile.display_name || profile.username}
                    </h1>
                    {profile.is_vip && (
                      <Badge variant="default" className="gap-1">
                        <Crown className="h-3 w-3" /> VIP
                      </Badge>
                    )}
                    {profile.generation_number && profile.generation_number > 1 && (
                      <Badge variant="secondary">Gen {profile.generation_number}</Badge>
                    )}
                  </div>
                  {profile.display_name && (
                    <p className="text-muted-foreground text-sm">@{profile.username}</p>
                  )}
                </div>

                {/* Action buttons */}
                {!isOwnProfile && currentUser && (
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    {!friendship && (
                      <Button size="sm" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending}>
                        <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                      </Button>
                    )}
                    {isPendingSent && (
                      <Button size="sm" variant="secondary" disabled>
                        <Clock className="h-4 w-4 mr-1" /> Request Sent
                      </Button>
                    )}
                    {isPendingReceived && (
                      <Button size="sm" onClick={() => acceptRequest.mutate()} disabled={acceptRequest.isPending}>
                        <UserPlus className="h-4 w-4 mr-1" /> Accept Request
                      </Button>
                    )}
                    {isFriend && (
                      <Button size="sm" variant="destructive" onClick={() => removeFriend.mutate()} disabled={removeFriend.isPending}>
                        <UserMinus className="h-4 w-4 mr-1" /> Remove Friend
                      </Button>
                    )}

                    {/* Invite to band */}
                    {myBands && myBands.length > 0 && (
                      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Send className="h-4 w-4 mr-1" /> Invite to Band
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite {profile.display_name || profile.username} to Band</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Band</Label>
                              <Select value={selectedBand} onValueChange={setSelectedBand}>
                                <SelectTrigger><SelectValue placeholder="Select a band" /></SelectTrigger>
                                <SelectContent>
                                  {myBands.map((band: any) => (
                                    <SelectItem key={band.id} value={band.id}>{band.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Instrument Role</Label>
                              <Select value={instrumentRole} onValueChange={setInstrumentRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {INSTRUMENTS.map(i => (
                                    <SelectItem key={i} value={i}>{i}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Vocal Role</Label>
                              <Select value={vocalRole} onValueChange={setVocalRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {VOCAL_ROLES.map(v => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Message (optional)</Label>
                              <Textarea
                                value={inviteMessage}
                                onChange={e => setInviteMessage(e.target.value)}
                                placeholder="Hey, want to join our band?"
                                rows={2}
                              />
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => inviteToBand.mutate()}
                              disabled={!selectedBand || inviteToBand.isPending}
                            >
                              {inviteToBand.isPending ? "Sending..." : "Send Invitation"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {profile.age && <span>Age {profile.age}</span>}
                {profile.gender && <span className="capitalize">{profile.gender}</span>}
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {profile.city.name}, {profile.city.country}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {format(new Date(profile.created_at!), "MMMM yyyy")}
                </span>
              </div>

              {/* Vitals */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-destructive" />
                  <Progress value={profile.health || 100} className="h-1.5 w-20" />
                  <span className="text-xs text-muted-foreground">{profile.health || 100}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-warning" />
                  <Progress value={profile.energy || 100} className="h-1.5 w-20" />
                  <span className="text-xs text-muted-foreground">{profile.energy || 100}%</span>
                </div>
              </div>

              {profile.bio && <p className="text-sm">{profile.bio}</p>}

              {/* Status badges */}
              <div className="flex gap-2 flex-wrap">
                {profile.is_imprisoned && <Badge variant="destructive"><Shield className="h-3 w-3 mr-1" />Imprisoned</Badge>}
                {profile.is_traveling && <Badge variant="secondary"><MapPin className="h-3 w-3 mr-1" />Traveling</Badge>}
                {profile.current_activity && (
                  <Badge variant="outline">{profile.current_activity}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          {/* Attributes */}
          {profile.attributes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Attributes</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(profile.attributes).map(([key, value]) => (
                    <div key={key} className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-lg font-bold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Music className="h-5 w-5" /> Bands
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!profile.band_members || profile.band_members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not a member of any bands yet.</p>
              ) : (
                <div className="space-y-4">
                  {profile.band_members.map((membership: any, idx: number) => (
                    <div key={membership.id}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/band/${membership.bands?.id}`} className="font-medium hover:underline">
                              {membership.bands?.name}
                            </Link>
                            {membership.bands?.genre && (
                              <Badge variant="secondary">{membership.bands.genre}</Badge>
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
                            <span>Fame: {membership.bands?.fame || 0}</span>
                            <span>Chemistry: {membership.bands?.chemistry_level || 0}</span>
                          </div>
                        </div>
                        {membership.joined_at && (
                          <div className="text-xs text-muted-foreground">
                            Joined {format(new Date(membership.joined_at), "MMM yyyy")}
                          </div>
                        )}
                      </div>
                      {idx < profile.band_members.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* City Info */}
          {profile.city && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" /> Location
              </CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{profile.city.name}, {profile.city.country}</p>
                    {profile.city.music_scene && (
                      <p className="text-sm text-muted-foreground">Music Scene: {profile.city.music_scene}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-5 w-5" /> Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              {skillsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading skills...</p>
              ) : !skills || skills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No skills trained yet.</p>
              ) : (
                <div className="space-y-3">
                  {skills.map(skill => {
                    const level = skill.current_level || 0;
                    const xp = skill.current_xp || 0;
                    const reqXp = skill.required_xp || 100;
                    const xpPct = reqXp > 0 ? Math.min((xp / reqXp) * 100, 100) : 0;

                    return (
                      <div key={skill.skill_slug} className="flex items-center gap-3">
                        <div className="w-40 sm:w-52 flex-shrink-0">
                          <p className="text-sm font-medium capitalize truncate">{skill.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {xp}/{reqXp} XP
                            {skill.last_practiced_at && (
                              <> · Last: {format(new Date(skill.last_practiced_at), "MMM d")}</>
                            )}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 w-12 justify-center">
                          Lv {level}
                        </Badge>
                        <Progress value={xpPct} className="h-2 flex-1" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}