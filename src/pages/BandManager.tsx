import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  Music, 
  Guitar, 
  Mic, 
  Drum,
  TrendingUp,
  UserPlus,
  Settings,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

interface BandMember {
  id: string;
  user_id: string;
  band_id: string;
  role: string;
  salary: number;
  joined_at: string;
  name?: string;
  skills?: any;
  avatar_url?: string;
  is_player?: boolean;
}

interface Band {
  id: string;
  name: string;
  genre: string;
  description: string;
  leader_id: string;
  popularity: number;
  weekly_fans: number;
  max_members: number;
  created_at: string;
  updated_at: string;
}

const BandManager = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  
  const [band, setBand] = useState<Band | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadBandData();
    }
  }, [user]);

  const loadBandData = async () => {
    try {
      // Check if user has a band (as leader or member)
      const { data: memberData, error: memberError } = await supabase
        .from('band_members')
        .select(`
          *,
          band:bands(*)
        `)
        .eq('user_id', user!.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        throw memberError;
      }

      if (memberData?.band) {
        setBand(memberData.band);
        await loadBandMembers(memberData.band.id);
      }
    } catch (error: any) {
      console.error('Error loading band data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBandMembers = async (bandId: string) => {
    try {
      const { data, error } = await supabase
        .from('band_members')
        .select(`
          *,
          profile:profiles(display_name, avatar_url),
          skills:player_skills(*)
        `)
        .eq('band_id', bandId);

      if (error) throw error;

      const membersWithData = data.map((member: any) => ({
        ...member,
        name: member.user_id === user!.id ? 'You' : (member.profile?.display_name || 'Unknown'),
        avatar_url: member.profile?.avatar_url || '',
        is_player: member.user_id === user!.id,
        skills: member.skills || {}
      }));

      setMembers(membersWithData);
    } catch (error: any) {
      console.error('Error loading band members:', error);
    }
  };

  const createBand = async () => {
    if (!user || !profile) return;

    setCreating(true);
    try {
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .insert({
          name: `${profile.display_name || 'Player'}'s Band`,
          genre: 'Rock',
          description: 'A new band ready to rock the world!',
          leader_id: user.id
        })
        .select()
        .single();

      if (bandError) throw bandError;

      // Add the user as the first member
      const { error: memberError } = await supabase
        .from('band_members')
        .insert({
          band_id: bandData.id,
          user_id: user.id,
          role: 'Lead Vocals',
          salary: 0
        });

      if (memberError) throw memberError;

      setBand(bandData);
      await loadBandMembers(bandData.id);

      toast({
        title: "Band Created!",
        description: "Your musical journey as a band begins now!",
      });
    } catch (error: any) {
      console.error('Error creating band:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create band",
      });
    } finally {
      setCreating(false);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role.includes("Vocal")) return <Mic className="h-4 w-4" />;
    if (role.includes("Guitar")) return <Guitar className="h-4 w-4" />;
    if (role.includes("Drum")) return <Drum className="h-4 w-4" />;
    return <Music className="h-4 w-4" />;
  };

  const getSkillColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading band data...</p>
        </div>
      </div>
    );
  }

  // If no band, show creation interface
  if (!band) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20 max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
              Start Your Band
            </CardTitle>
            <CardDescription>
              Create a band and recruit talented musicians to join your musical journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <Users className="h-16 w-16 text-primary mx-auto" />
              <p className="text-muted-foreground">
                You're currently a solo artist. Create a band to collaborate with other musicians!
              </p>
            </div>
            <Button
              onClick={createBand}
              disabled={creating}
              className="w-full bg-gradient-primary"
            >
              {creating ? "Creating..." : "Create Band"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {band.name}
            </h1>
            <p className="text-muted-foreground">{band.genre} • {members.length}/{band.max_members} members</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-gradient-primary hover:shadow-electric">
              <UserPlus className="h-4 w-4 mr-2" />
              Recruit Member
            </Button>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
              <Settings className="h-4 w-4 mr-2" />
              Band Settings
            </Button>
          </div>
        </div>

        {/* Band Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Popularity</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{band.popularity}%</div>
              <Progress value={band.popularity} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Band popularity
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {band.weekly_fans.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Weekly fan growth
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chart Position</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{members.length}</div>
              <p className="text-xs text-muted-foreground">
                Band members
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gigs Played</CardTitle>
              <Music className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {new Date(band.created_at).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Band formed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Band Members */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Band Members
            </CardTitle>
            <CardDescription>
              Your musical collaborators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {members.map((member) => (
                <div key={member.id} className="p-4 rounded-lg bg-secondary/30 border border-primary/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {member.name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {member.name}
                          {member.is_player && (
                            <Badge variant="outline" className="text-xs border-primary text-primary">
                              You
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          {member.role}
                        </p>
                      </div>
                    </div>
                    {member.salary > 0 && (
                      <Badge variant="outline" className="text-xs border-success text-success">
                        ${member.salary}/week
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Skills</h4>
                    {member.is_player && skills ? (
                      Object.entries(skills).filter(([key]) => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at').map(([skill, value]) => (
                        <div key={skill} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{skill}</span>
                            <span className={getSkillColor(value as number)}>{value}/100</span>
                          </div>
                          <Progress value={value as number} className="h-1.5" />
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Skills unavailable for other members
                      </div>
                    )}
                  </div>

                  {!member.is_player && (
                    <div className="mt-4 pt-3 border-t border-primary/10">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs">
                          View Profile
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/20">
                          Replace
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Band Achievements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your band's milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Songs Written</p>
                    <p className="text-sm text-muted-foreground">Creative output</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">0</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Albums Released</p>
                    <p className="text-sm text-muted-foreground">Studio recordings</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-accent">0</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Upcoming band activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Band Practice</p>
                    <p className="text-sm text-muted-foreground">Studio rehearsal</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Today</Badge>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Recording Session</p>
                    <p className="text-sm text-muted-foreground">New single</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Tomorrow</Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Live Gig</p>
                    <p className="text-sm text-muted-foreground">The Underground Club</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Saturday</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BandManager;