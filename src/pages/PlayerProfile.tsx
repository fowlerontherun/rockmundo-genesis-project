import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Music, Calendar, MapPin, Heart, Zap, Star, Trophy,
  Crown, Shield, Flame, Clock, TrendingUp, Users
} from "lucide-react";
import { format } from "date-fns";

export default function PlayerProfile() {
  const { playerId } = useParams();
  const [activeTab, setActiveTab] = useState("profile");

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

      // Fetch city, band memberships, and reputation in parallel
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
          .select("charisma, stage_presence, creativity, discipline, resilience, luck, streetwise, networking")
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

  // Skills query - only fetched when skills tab is active
  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ["player-skills", playerId],
    queryFn: async () => {
      if (!playerId) return [];

      // Fetch skill progress with definitions
      const { data: progressData } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level, current_xp, required_xp, last_practiced_at")
        .eq("profile_id", playerId)
        .order("current_level", { ascending: false });

      if (!progressData || progressData.length === 0) return [];

      // Fetch display names from skill_definitions
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
