import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Heart, AlertTriangle, MessageSquare, Star, Coffee, Loader2, Target } from "lucide-react";

type ProfileSkillProgressRow = Database["public"]["Tables"]["profile_skill_progress"]["Row"];
type ProfileSkillUnlockRow = Database["public"]["Tables"]["profile_skill_unlocks"]["Row"];
type SkillDefinitionRow = Database["public"]["Tables"]["skill_definitions"]["Row"];

const SKILL_LABELS: Record<string, string> = {
  guitar: "Guitar",
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  performance: "Performance",
  songwriting: "Songwriting",
};

const CORE_SKILL_SLUGS = Object.keys(SKILL_LABELS);

type SkillEntry = {
  level: number;
  unlocked: boolean;
  hasProgress: boolean;
};

type SkillMap = Record<string, SkillEntry>;

type SkillStatusType = "ready" | "developing" | "locked" | "missing";

type SkillStatus = {
  slug: string;
  label: string;
  level: number;
  unlocked: boolean;
  hasProgress: boolean;
  status: SkillStatusType;
};

const formatSkillLabel = (slug: string) =>
  SKILL_LABELS[slug] ??
  slug
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const clampStat = (value: number) => Math.max(0, Math.min(100, value));

const getMoodFromMorale = (morale: number) => {
  if (morale >= 85) return "Excited";
  if (morale >= 70) return "Motivated";
  if (morale >= 55) return "Content";
  if (morale >= 40) return "Neutral";
  return "Frustrated";
};

const getRoleAvatar = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized.includes("drum")) return "🥁";
  if (normalized.includes("bass")) return "🎵";
  if (normalized.includes("keyboard") || normalized.includes("piano")) return "🎹";
  if (normalized.includes("vocal")) return "🎤";
  if (normalized.includes("guitar")) return "🎸";
  return "🎼";
};

const getRolePersonality = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized.includes("lead")) return "Dynamic";
  if (normalized.includes("bass")) return "Steady";
  if (normalized.includes("drum")) return "Intense";
  if (normalized.includes("keyboard")) return "Harmonious";
  if (normalized.includes("vocal")) return "Charismatic";
  return "Collaborative";
};

const getMoodColor = (mood: string) => {
  switch (mood) {
    case "Excited":
      return "text-blue-300";
    case "Motivated":
      return "text-green-400";
    case "Content":
      return "text-yellow-400";
    case "Neutral":
      return "text-cream/70";
    case "Frustrated":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
};

const getChemistryColor = (chemistry: number) => {
  if (chemistry >= 80) return "text-green-400";
  if (chemistry >= 60) return "text-yellow-400";
  if (chemistry >= 40) return "text-orange-400";
  return "text-red-400";
};

type BandMemberCard = {
  id: string;
  userId: string;
  name: string;
  instrument: string;
  mood: string;
  morale: number;
  chemistry: number;
  skill: number;
  loyalty: number;
  energy: number;
  avatar: string;
  personality: string;
  issues: string[];
  strengths: string[];
};

type TeamEvent = {
  id: number;
  name: string;
  cost: number;
  moraleBenefit: number;
  chemistryBenefit: number;
  duration: string;
  description: string;
};

type ConflictSeverity = "High" | "Medium" | "Low";

type BandConflict = {
  id: number;
  type: string;
  members: string[];
  severity: ConflictSeverity;
  description: string;
  timeAgo: string;
  resolved: boolean;
  moraleDelta: number;
  chemistryDelta: number;
  cost: number;
};

const getSeverityColor = (severity: ConflictSeverity) => {
  switch (severity) {
    case "High":
      return "bg-red-500";
    case "Medium":
      return "bg-yellow-500";
    case "Low":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

const teamEvents: TeamEvent[] = [
  {
    id: 1,
    name: "Band Dinner",
    cost: 200,
    moraleBenefit: 15,
    chemistryBenefit: 10,
    duration: "2 hours",
    description: "Casual dinner to bond and discuss music",
  },
  {
    id: 2,
    name: "Studio Jam Session",
    cost: 500,
    moraleBenefit: 20,
    chemistryBenefit: 25,
    duration: "4 hours",
    description: "Free-form creative session to build musical chemistry",
  },
  {
    id: 3,
    name: "Team Building Retreat",
    cost: 2000,
    moraleBenefit: 35,
    chemistryBenefit: 40,
    duration: "2 days",
    description: "Weekend retreat focused on communication and collaboration",
  },
];

const initialConflicts: BandConflict[] = [
  {
    id: 1,
    type: "Creative Difference",
    members: ["Alex Rivera", "Sam Taylor"],
    severity: "Medium",
    description: "Disagreement over song arrangement for new single",
    timeAgo: "2 days ago",
    resolved: false,
    moraleDelta: 12,
    chemistryDelta: 9,
    cost: 150,
  },
  {
    id: 2,
    type: "Schedule Conflict",
    members: ["Sam Taylor"],
    severity: "Low",
    description: "Wants different rehearsal times due to side job",
    timeAgo: "1 week ago",
    resolved: false,
    moraleDelta: 8,
    chemistryDelta: 6,
    cost: 0,
  },
];

const BandChemistry = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bandId, setBandId] = useState<string | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMemberCard[]>([]);
  const [bandMorale, setBandMorale] = useState(0);
  const [bandEventCount, setBandEventCount] = useState(0);
  const [recentConflicts, setRecentConflicts] = useState<BandConflict[]>(() => initialConflicts);
  const [loading, setLoading] = useState(true);
  const [processingEventId, setProcessingEventId] = useState<number | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<number | null>(null);

  // Mock data for demonstration
  const mockBandMembers: BandMemberCard[] = [
    {
      id: "1",
      userId: "user1",
      name: "Alex Rivera",
      instrument: "Lead Guitar",
      mood: "Motivated",
      morale: 75,
      chemistry: 85,
      skill: 70,
      loyalty: 80,
      energy: 90,
      avatar: "🎸",
      personality: "Dynamic",
      issues: ["Wants more creative input"],
      strengths: ["Guitar expertise", "Stage presence"],
    },
    {
      id: "2",
      userId: "user2",
      name: "Sam Taylor",
      instrument: "Vocals",
      mood: "Content",
      morale: 60,
      chemistry: 70,
      skill: 65,
      loyalty: 75,
      energy: 80,
      avatar: "🎤",
      personality: "Charismatic",
      issues: ["Schedule conflicts", "Seeking clearer communication"],
      strengths: ["Vocal talent", "Audience connection"],
    },
  ];

  useEffect(() => {
    const loadBandData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        // For now, use mock data
        setBandMembers(mockBandMembers);
        setBandMorale(67);
        setBandEventCount(3);
      } catch (error) {
        console.error("Error loading band data:", error);
        toast({
          title: "Error",
          description: "Failed to load band data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBandData();
  }, [user, toast]);

  const averageChemistry = useMemo(() => {
    if (bandMembers.length === 0) return 0;
    const total = bandMembers.reduce((sum, member) => sum + member.chemistry, 0);
    return Math.round(total / bandMembers.length);
  }, [bandMembers]);

  const activeConflicts = useMemo(
    () => recentConflicts.filter((conflict) => !conflict.resolved).length,
    [recentConflicts]
  );

  const organizeTeamEvent = async (event: TeamEvent) => {
    setProcessingEventId(event.id);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setBandMembers(prev => 
      prev.map(member => ({
        ...member,
        morale: clampStat(member.morale + event.moraleBenefit),
        chemistry: clampStat(member.chemistry + event.chemistryBenefit),
        mood: getMoodFromMorale(clampStat(member.morale + event.moraleBenefit)),
      }))
    );
    
    setBandEventCount(prev => prev + 1);
    setProcessingEventId(null);
    
    toast({
      title: "Event Organized!",
      description: `${event.name} improved team morale and chemistry`,
    });
  };

  const resolveConflict = async (conflict: BandConflict) => {
    setResolvingConflictId(conflict.id);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setRecentConflicts(prev =>
      prev.map(c => c.id === conflict.id ? { ...c, resolved: true } : c)
    );
    
    setBandMembers(prev =>
      prev.map(member => ({
        ...member,
        morale: clampStat(member.morale + conflict.moraleDelta),
        chemistry: clampStat(member.chemistry + conflict.chemistryDelta),
        mood: getMoodFromMorale(clampStat(member.morale + conflict.moraleDelta)),
      }))
    );
    
    setResolvingConflictId(null);
    
    toast({
      title: "Conflict Resolved",
      description: `Successfully resolved ${conflict.type.toLowerCase()}`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Band Chemistry</h1>
          <p className="text-lg text-gray-300">
            Manage your band's relationships and team dynamics
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Band Morale</p>
                  <p className="text-2xl font-bold text-white">{bandMorale}%</p>
                </div>
                <Heart className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Chemistry</p>
                  <p className={`text-2xl font-bold ${getChemistryColor(averageChemistry)}`}>
                    {averageChemistry}%
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Conflicts</p>
                  <p className="text-2xl font-bold text-orange-400">{activeConflicts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Team Events</p>
                  <p className="text-2xl font-bold text-green-400">{bandEventCount}</p>
                </div>
                <Coffee className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="members" className="text-white">Band Members</TabsTrigger>
            <TabsTrigger value="events" className="text-white">Team Events</TabsTrigger>
            <TabsTrigger value="conflicts" className="text-white">Conflicts</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bandMembers.map((member) => (
                <Card key={member.id} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{member.avatar}</span>
                        <div>
                          <CardTitle className="text-white">{member.name}</CardTitle>
                          <CardDescription className="text-gray-400">
                            {member.instrument} • {member.personality}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={getMoodColor(member.mood)}>
                        {member.mood}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-400">Morale</span>
                          <span className="text-sm text-white">{member.morale}%</span>
                        </div>
                        <Progress value={member.morale} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-400">Chemistry</span>
                          <span className={`text-sm ${getChemistryColor(member.chemistry)}`}>
                            {member.chemistry}%
                          </span>
                        </div>
                        <Progress value={member.chemistry} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-400">Skill</span>
                          <span className="text-sm text-white">{member.skill}%</span>
                        </div>
                        <Progress value={member.skill} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-400">Energy</span>
                          <span className="text-sm text-white">{member.energy}%</span>
                        </div>
                        <Progress value={member.energy} className="h-2" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Strengths</h4>
                      <div className="flex flex-wrap gap-1">
                        {member.strengths.map((strength, index) => (
                          <Badge key={index} variant="outline" className="text-green-400 border-green-400">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {member.issues.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Issues</h4>
                        <div className="flex flex-wrap gap-1">
                          {member.issues.map((issue, index) => (
                            <Badge key={index} variant="outline" className="text-orange-400 border-orange-400">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teamEvents.map((event) => (
                <Card key={event.id} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">{event.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {event.duration} • ${event.cost}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-300">{event.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Morale Boost</span>
                        <span className="text-sm text-green-400">+{event.moraleBenefit}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Chemistry Boost</span>
                        <span className="text-sm text-blue-400">+{event.chemistryBenefit}%</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => organizeTeamEvent(event)}
                      disabled={processingEventId === event.id}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {processingEventId === event.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Organizing...
                        </>
                      ) : (
                        `Organize Event`
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="conflicts" className="space-y-4">
            <div className="space-y-4">
              {recentConflicts.map((conflict) => (
                <Card key={conflict.id} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white">{conflict.type}</CardTitle>
                        <CardDescription className="text-gray-400">
                          {conflict.members.join(", ")} • {conflict.timeAgo}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={`${getSeverityColor(conflict.severity)} text-white`}>
                          {conflict.severity}
                        </Badge>
                        {conflict.resolved && (
                          <Badge className="bg-green-600 text-white">Resolved</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-300">{conflict.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-400">Morale Impact</span>
                        <p className="text-red-400">-{conflict.moraleDelta}%</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-400">Chemistry Impact</span>
                        <p className="text-red-400">-{conflict.chemistryDelta}%</p>
                      </div>
                    </div>

                    {!conflict.resolved && (
                      <Button
                        onClick={() => resolveConflict(conflict)}
                        disabled={resolvingConflictId === conflict.id}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {resolvingConflictId === conflict.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Resolving...
                          </>
                        ) : (
                          `Resolve Conflict (${conflict.cost > 0 ? `$${conflict.cost}` : 'Free'})`
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BandChemistry;