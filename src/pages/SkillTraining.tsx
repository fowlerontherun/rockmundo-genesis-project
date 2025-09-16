import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Guitar, Mic, Music, Drum, Volume2, PenTool, Star, Coins, Clock, TrendingUp } from "lucide-react";

interface PlayerSkills {
  guitar: number;
  vocals: number;
  drums: number;
  bass: number;
  performance: number;
  songwriting: number;
}

interface TrainingSession {
  skill: keyof PlayerSkills;
  name: string;
  icon: any;
  cost: number;
  duration: number;
  xpGain: number;
  description: string;
}

const SkillTraining = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);

  const trainingSessions: TrainingSession[] = [
    {
      skill: "guitar",
      name: "Guitar Practice",
      icon: Guitar,
      cost: 100,
      duration: 30,
      xpGain: 5,
      description: "Master guitar techniques and improve your playing skills"
    },
    {
      skill: "vocals",
      name: "Vocal Training",
      icon: Mic,
      cost: 150,
      duration: 45,
      xpGain: 6,
      description: "Develop your voice range, control, and stage presence"
    },
    {
      skill: "drums",
      name: "Drum Lessons",
      icon: Drum,
      cost: 120,
      duration: 40,
      xpGain: 5,
      description: "Learn rhythm patterns and improve your timing"
    },
    {
      skill: "bass",
      name: "Bass Workshop",
      icon: Volume2,
      cost: 110,
      duration: 35,
      xpGain: 5,
      description: "Strengthen your bass fundamentals and groove"
    },
    {
      skill: "performance",
      name: "Stage Performance",
      icon: Star,
      cost: 200,
      duration: 60,
      xpGain: 8,
      description: "Enhance your stage presence and crowd engagement"
    },
    {
      skill: "songwriting",
      name: "Songwriting Class",
      icon: PenTool,
      cost: 180,
      duration: 50,
      xpGain: 7,
      description: "Learn composition, lyrics, and musical arrangement"
    }
  ];

  useEffect(() => {
    if (user) {
      fetchPlayerData();
    }
  }, [user]);

  const fetchPlayerData = async () => {
    try {
      const [skillsResponse, profileResponse] = await Promise.all([
        supabase.from("player_skills").select("*").eq("user_id", user?.id).single(),
        supabase.from("profiles").select("*").eq("user_id", user?.id).single()
      ]);

      if (skillsResponse.data) setSkills(skillsResponse.data);
      if (profileResponse.data) setProfile(profileResponse.data);
    } catch (error) {
      console.error("Error fetching player data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTraining = async (session: TrainingSession) => {
    if (!skills || !profile || profile.cash < session.cost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${session.cost} to afford this training session.`
      });
      return;
    }

    setTraining(true);

    try {
      const newSkillValue = Math.min(100, skills[session.skill] + session.xpGain);
      const newCash = profile.cash - session.cost;
      const newExperience = profile.experience + session.xpGain;

      // Update skills
      const { error: skillsError } = await supabase
        .from("player_skills")
        .update({
          [session.skill]: newSkillValue,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user?.id);

      if (skillsError) throw skillsError;

      // Update profile (cash and experience)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          cash: newCash,
          experience: newExperience,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user?.id);

      if (profileError) throw profileError;

      // Add activity feed entry
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "training",
          message: `Completed ${session.name} training session (+${session.xpGain} XP)`,
          earnings: -session.cost
        });

      // Update local state
      setSkills(prev => prev ? { ...prev, [session.skill]: newSkillValue } : null);
      setProfile(prev => prev ? { ...prev, cash: newCash, experience: newExperience } : null);

      toast({
        title: "Training Complete!",
        description: `Your ${session.skill} skill increased by ${session.xpGain} points!`
      });

    } catch (error) {
      console.error("Error during training:", error);
      toast({
        variant: "destructive",
        title: "Training Failed",
        description: "Something went wrong during your training session."
      });
    } finally {
      setTraining(false);
    }
  };

  const getSkillLevel = (skill: number): string => {
    if (skill >= 90) return "Master";
    if (skill >= 75) return "Expert";
    if (skill >= 60) return "Advanced";
    if (skill >= 40) return "Intermediate";
    if (skill >= 20) return "Beginner";
    return "Novice";
  };

  const getSkillColor = (skill: number): string => {
    if (skill >= 90) return "text-purple-400";
    if (skill >= 75) return "text-blue-400";
    if (skill >= 60) return "text-green-400";
    if (skill >= 40) return "text-yellow-400";
    if (skill >= 20) return "text-orange-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading training center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">SKILL TRAINING CENTER</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Hone your craft and become a music legend
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-oswald">${profile?.cash?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{profile?.experience || 0} XP</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="skills" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="skills">Current Skills</TabsTrigger>
          <TabsTrigger value="training">Training Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills && Object.entries(skills).filter(([key]) => key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at').map(([skill, value]) => {
              const session = trainingSessions.find(s => s.skill === skill);
              const Icon = session?.icon || Music;
              
              return (
                <Card key={skill} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg font-oswald capitalize">{skill}</CardTitle>
                      </div>
                      <Badge variant="outline" className={getSkillColor(value as number)}>
                        {getSkillLevel(value as number)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-mono">{value}/100</span>
                      </div>
                      <Progress value={value as number} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingSessions.map((session) => {
              const Icon = session.icon;
              const currentSkill = skills?.[session.skill] || 0;
              const canAfford = (profile?.cash || 0) >= session.cost;
              const isMaxed = currentSkill >= 100;

              return (
                <Card key={session.skill} className="relative">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg font-oswald">{session.name}</CardTitle>
                        <CardDescription className="text-sm">{session.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Coins className="h-3 w-3 text-yellow-400" />
                        <span>${session.cost}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-400" />
                        <span>{session.duration}m</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-purple-400" />
                        <span>+{session.xpGain} XP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span>Skill: {currentSkill}/100</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleTraining(session)}
                      disabled={training || !canAfford || isMaxed}
                      className="w-full"
                      variant={canAfford && !isMaxed ? "default" : "outline"}
                    >
                      {training ? "Training..." : 
                       isMaxed ? "Skill Maxed" :
                       !canAfford ? "Can't Afford" : "Start Training"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SkillTraining;