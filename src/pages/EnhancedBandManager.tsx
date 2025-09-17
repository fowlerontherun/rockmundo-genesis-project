import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Users, Crown, Heart, UserPlus, UserMinus, Star, TrendingUp, Calendar, Music, Coins, Settings } from "lucide-react";

interface Band {
  id: string;
  name: string;
  description: string;
  genre: string;
  popularity: number;
  weekly_fans: number;
  max_members: number;
  leader_id: string;
  created_at: string;
}

interface BandMember {
  id: string;
  user_id: string;
  band_id: string;
  role: string;
  salary: number;
  joined_at: string;
  profiles: {
    username: string;
    display_name: string;
    level: number;
    avatar_url: string;
  };
  player_skills: {
    guitar: number;
    vocals: number;
    drums: number;
    bass: number;
    performance: number;
    songwriting: number;
  };
}

interface BandStats {
  totalSkill: number;
  chemistry: number;
  weeklyIncome: number;
  songsCreated: number;
  gigsPerformed: number;
}

const EnhancedBandManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myBands, setMyBands] = useState<Band[]>([]);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [bandStats, setBandStats] = useState<BandStats | null>(null);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [newBand, setNewBand] = useState({
    name: "",
    description: "",
    genre: "",
    max_members: 4
  });

  const [inviteData, setInviteData] = useState({
    role: "",
    salary: 0
  });

  const genres = [
    "Rock", "Pop", "Hip Hop", "Electronic", "Jazz", "Blues", "Country",
    "Metal", "Punk", "Alternative", "Indie", "Classical", "Folk", "R&B"
  ];

  const roles = [
    "Lead Guitarist", "Rhythm Guitarist", "Bassist", "Drummer", 
    "Lead Vocalist", "Backing Vocalist", "Keyboardist", "Producer"
  ];

  const getUserBandIds = useCallback(async (): Promise<string> => {
    const { data } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", user?.id);

    return data?.map(m => m.band_id).join(",") || "";
  }, [user?.id]);

  const fetchBands = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("bands")
        .select("*")
        .or(`leader_id.eq.${user?.id},id.in.(${await getUserBandIds()})`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMyBands(data || []);

      if (data && data.length > 0) {
        setSelectedBand(data[0]);
      }
    } catch (error) {
      console.error("Error fetching bands:", error);
    } finally {
      setLoading(false);
    }
  }, [getUserBandIds, user?.id]);

  const calculateBandStats = useCallback((members: BandMember[]): BandStats => {
    const totalSkills = members.reduce((acc, member) => {
      const skills = member.player_skills;
      return acc + skills.guitar + skills.vocals + skills.drums + skills.bass + skills.performance + skills.songwriting;
    }, 0);

    const avgSkill = members.length > 0 ? totalSkills / (members.length * 6) : 0;

    // Chemistry calculation based on skill balance and member count
    const chemistry = Math.min(100, Math.max(0, avgSkill * (members.length / 4) * 1.2));

    const weeklyIncome = Math.round(chemistry * 10 + (selectedBand?.popularity ?? 0) * 5);

    return {
      totalSkill: Math.round(avgSkill),
      chemistry: Math.round(chemistry),
      weeklyIncome,
      songsCreated: 0, // Would need to fetch from songs table
      gigsPerformed: 0  // Would need to fetch from gigs table
    };
  }, [selectedBand?.popularity]);

  const fetchAvailableMembers = useCallback(async (currentMemberIds: string[]) => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .neq("user_id", user?.id)
        .limit(20);

      if (profilesError) throw profilesError;

      // Fetch skills for each profile
      const profilesWithSkills = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: skills } = await supabase
            .from("player_skills")
            .select("guitar, vocals, drums, bass, performance, songwriting")
            .eq("user_id", profile.user_id)
            .single();

          return {
            ...profile,
            player_skills: skills || { guitar: 20, vocals: 20, drums: 20, bass: 20, performance: 20, songwriting: 20 }
          };
        })
      );

      const available = profilesWithSkills?.filter(p => !currentMemberIds.includes(p.user_id)) || [];

      setAvailableMembers(available);
    } catch (error) {
      console.error("Error fetching available members:", error);
    }
  }, [user?.id]);

  const fetchBandDetails = useCallback(async () => {
    if (!selectedBand) return null;

    try {
      // Fetch band members with their profiles and skills separately due to relation constraints
      const { data: members, error: membersError } = await supabase
        .from("band_members")
        .select("*")
        .eq("band_id", selectedBand.id);

      if (membersError) throw membersError;

      // Fetch profiles and skills for each member
      const membersWithDetails = await Promise.all(
        (members || []).map(async (member) => {
          const [profileRes, skillsRes] = await Promise.all([
            supabase.from("profiles").select("username, display_name, level, avatar_url").eq("user_id", member.user_id).single(),
            supabase.from("player_skills").select("guitar, vocals, drums, bass, performance, songwriting").eq("user_id", member.user_id).single()
          ]);

          return {
            ...member,
            profiles: profileRes.data || { username: "", display_name: "", level: 1, avatar_url: "" },
            player_skills: skillsRes.data || { guitar: 20, vocals: 20, drums: 20, bass: 20, performance: 20, songwriting: 20 }
          };
        })
      );

      setBandMembers(membersWithDetails);

      if (membersWithDetails) {
        const stats = calculateBandStats(membersWithDetails);
        setBandStats(stats);
        const currentMemberIds = membersWithDetails.map(member => member.user_id);
        await fetchAvailableMembers(currentMemberIds);
      }

      return membersWithDetails;
    } catch (error) {
      console.error("Error fetching band details:", error);
      return null;
    }
  }, [calculateBandStats, fetchAvailableMembers, selectedBand]);

  useEffect(() => {
    if (user) {
      fetchBands();
    }
  }, [user, fetchBands]);

  useEffect(() => {
    if (selectedBand) {
      fetchBandDetails();
    }
  }, [selectedBand, fetchBandDetails]);

  const createBand = async () => {
    if (!newBand.name || !newBand.genre) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a band name and genre."
      });
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase
        .from("bands")
        .insert({
          name: newBand.name,
          description: newBand.description,
          genre: newBand.genre,
          max_members: newBand.max_members,
          leader_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add the creator as the first member
      await supabase
        .from("band_members")
        .insert({
          band_id: data.id,
          user_id: user?.id,
          role: "Band Leader",
          salary: 0
        });

      // Add activity
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "band",
          message: `Created new band: "${newBand.name}"`,
          earnings: 0
        });

      setMyBands(prev => [data, ...prev]);
      setSelectedBand(data);
      setNewBand({ name: "", description: "", genre: "", max_members: 4 });

      toast({
        title: "Band Created!",
        description: `"${newBand.name}" is ready to rock the world!`
      });

    } catch (error) {
      console.error("Error creating band:", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: "Failed to create band. Please try again."
      });
    } finally {
      setCreating(false);
    }
  };

  const inviteMember = async (memberId: string) => {
    if (!selectedBand || !inviteData.role) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a role for the new member."
      });
      return;
    }

    if (bandMembers.length >= selectedBand.max_members) {
      toast({
        variant: "destructive",
        title: "Band Full",
        description: "Your band has reached its maximum member capacity."
      });
      return;
    }

    setInviting(true);

    try {
      const { error } = await supabase
        .from("band_members")
        .insert({
          band_id: selectedBand.id,
          user_id: memberId,
          role: inviteData.role,
          salary: inviteData.salary
        });

      if (error) throw error;

      // Add activity
      const member = availableMembers.find(m => m.user_id === memberId);
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "band",
          message: `Invited ${member?.username} to join "${selectedBand.name}" as ${inviteData.role}`,
          earnings: 0
        });

      toast({
        title: "Member Invited!",
        description: `${member?.username} has been added to your band.`
      });

      await fetchBandDetails();
      setInviteData({ role: "", salary: 0 });

    } catch (error) {
      console.error("Error inviting member:", error);
      toast({
        variant: "destructive",
        title: "Invitation Failed",
        description: "Failed to invite member. Please try again."
      });
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedBand) return;

    try {
      const { error } = await supabase
        .from("band_members")
        .delete()
        .eq("band_id", selectedBand.id)
        .eq("user_id", memberId);

      if (error) throw error;

      const member = bandMembers.find(m => m.user_id === memberId);
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "band",
          message: `Removed ${member?.profiles.username} from "${selectedBand.name}"`,
          earnings: 0
        });

      toast({
        title: "Member Removed",
        description: "The member has been removed from your band."
      });

      await fetchBandDetails();

    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        variant: "destructive",
        title: "Removal Failed",
        description: "Failed to remove member. Please try again."
      });
    }
  };

  const isLeader = selectedBand?.leader_id === user?.id;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading band manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">BAND MANAGEMENT</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Build your musical empire with the perfect lineup
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="recruit">Recruit</TabsTrigger>
          <TabsTrigger value="create">Create Band</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {selectedBand ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-bebas text-2xl flex items-center gap-2">
                        {isLeader && <Crown className="h-5 w-5 text-yellow-400" />}
                        {selectedBand.name}
                      </CardTitle>
                      <CardDescription>{selectedBand.genre} • {bandMembers.length}/{selectedBand.max_members} members</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {myBands.map(band => (
                        <Button
                          key={band.id}
                          variant={selectedBand.id === band.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedBand(band)}
                        >
                          {band.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{selectedBand.description}</p>
                  
                  {bandStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <TrendingUp className="h-6 w-6 mx-auto mb-2 text-blue-400" />
                        <div className="text-2xl font-bold">{bandStats.totalSkill}</div>
                        <div className="text-sm text-muted-foreground">Avg Skill</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Heart className="h-6 w-6 mx-auto mb-2 text-red-400" />
                        <div className="text-2xl font-bold">{bandStats.chemistry}%</div>
                        <div className="text-sm text-muted-foreground">Chemistry</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Coins className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
                        <div className="text-2xl font-bold">${bandStats.weeklyIncome}</div>
                        <div className="text-sm text-muted-foreground">Weekly Income</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Star className="h-6 w-6 mx-auto mb-2 text-purple-400" />
                        <div className="text-2xl font-bold">{selectedBand.popularity}</div>
                        <div className="text-sm text-muted-foreground">Popularity</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-bebas">BAND CHEMISTRY</CardTitle>
                  <CardDescription>How well your band works together</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Overall Chemistry</span>
                      <span className="font-mono text-lg">{bandStats?.chemistry || 0}%</span>
                    </div>
                    <Progress value={bandStats?.chemistry || 0} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      Chemistry affects your band's performance quality, income potential, and fan growth rate.
                      Improve chemistry by balancing skills and maintaining good member relationships.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Bands</h3>
                <p className="text-muted-foreground">Create your first band to start your musical journey!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          {selectedBand && bandMembers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bandMembers.map((member) => (
                <Card key={member.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-oswald">{member.profiles.display_name}</CardTitle>
                          <CardDescription>@{member.profiles.username} • {member.role}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Level {member.profiles.level}</Badge>
                        {member.user_id === selectedBand.leader_id && (
                          <Crown className="h-4 w-4 text-yellow-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-mono">{member.player_skills.guitar}</div>
                        <div className="text-muted-foreground">Guitar</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono">{member.player_skills.vocals}</div>
                        <div className="text-muted-foreground">Vocals</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono">{member.player_skills.drums}</div>
                        <div className="text-muted-foreground">Drums</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono">{member.player_skills.bass}</div>
                        <div className="text-muted-foreground">Bass</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono">{member.player_skills.performance}</div>
                        <div className="text-muted-foreground">Performance</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono">{member.player_skills.songwriting}</div>
                        <div className="text-muted-foreground">Writing</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span>Salary: ${member.salary}/week</span>
                      <span>Joined: {new Date(member.joined_at).toLocaleDateString()}</span>
                    </div>

                    {isLeader && member.user_id !== user?.id && (
                      <Button
                        onClick={() => removeMember(member.user_id)}
                        variant="destructive"
                        size="sm"
                        className="w-full"
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove Member
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Members</h3>
                <p className="text-muted-foreground">
                  {selectedBand ? "Start recruiting members for your band!" : "Select a band to view members."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recruit" className="space-y-4">
          {selectedBand && isLeader ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="font-bebas">RECRUIT NEW MEMBERS</CardTitle>
                  <CardDescription>
                    Find talented musicians to join your band ({bandMembers.length}/{selectedBand.max_members} slots filled)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select value={inviteData.role} onValueChange={(value) => setInviteData(prev => ({ ...prev, role: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Weekly Salary ($)</label>
                      <Input
                        type="number"
                        min="0"
                        max="10000"
                        value={inviteData.salary}
                        onChange={(e) => setInviteData(prev => ({ ...prev, salary: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableMembers.map((member) => (
                  <Card key={member.user_id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-oswald">{member.display_name}</CardTitle>
                          <CardDescription>@{member.username} • Level {member.level}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-mono">{member.player_skills.guitar}</div>
                          <div className="text-muted-foreground">Guitar</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono">{member.player_skills.vocals}</div>
                          <div className="text-muted-foreground">Vocals</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono">{member.player_skills.drums}</div>
                          <div className="text-muted-foreground">Drums</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono">{member.player_skills.bass}</div>
                          <div className="text-muted-foreground">Bass</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono">{member.player_skills.performance}</div>
                          <div className="text-muted-foreground">Performance</div>
                        </div>
                        <div className="text-center">
                          <div className="font-mono">{member.player_skills.songwriting}</div>
                          <div className="text-muted-foreground">Writing</div>
                        </div>
                      </div>

                      <Button
                        onClick={() => inviteMember(member.user_id)}
                        disabled={inviting || !inviteData.role || bandMembers.length >= selectedBand.max_members}
                        className="w-full"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {inviting ? "Inviting..." : "Invite to Band"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {availableMembers.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Available Musicians</h3>
                    <p className="text-muted-foreground">All available musicians are currently in other bands.</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Leader Access Required</h3>
                <p className="text-muted-foreground">
                  {selectedBand ? "Only band leaders can recruit new members." : "Select a band first."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-bebas text-2xl">CREATE NEW BAND</CardTitle>
              <CardDescription>
                Form a new musical group and lead them to stardom
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Band Name</label>
                  <Input
                    placeholder="Enter band name..."
                    value={newBand.name}
                    onChange={(e) => setNewBand(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={newBand.genre} onValueChange={(value) => setNewBand(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe your band's style and vision..."
                  value={newBand.description}
                  onChange={(e) => setNewBand(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Maximum Members</label>
                <Select 
                  value={newBand.max_members.toString()} 
                  onValueChange={(value) => setNewBand(prev => ({ ...prev, max_members: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Members</SelectItem>
                    <SelectItem value="3">3 Members</SelectItem>
                    <SelectItem value="4">4 Members</SelectItem>
                    <SelectItem value="5">5 Members</SelectItem>
                    <SelectItem value="6">6 Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={createBand}
                disabled={creating || !newBand.name || !newBand.genre}
                className="w-full"
              >
                {creating ? "Creating Band..." : "Create Band"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedBandManager;