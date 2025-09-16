import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Heart, 
  Zap, 
  AlertTriangle, 
  Music, 
  MessageSquare, 
  Calendar,
  TrendingUp,
  Star,
  Coffee
} from "lucide-react";

const BandChemistry = () => {
  const { toast } = useToast();
  const [bandMorale] = useState(78);

  const bandMembers = [
    {
      id: 1,
      name: "Alex Rivera",
      instrument: "Lead Guitar",
      mood: "Motivated",
      chemistry: 85,
      skill: 92,
      loyalty: 78,
      energy: 90,
      avatar: "🎸",
      personality: "Creative",
      issues: [],
      strengths: ["Innovative solos", "Great stage presence", "Team player"]
    },
    {
      id: 2,
      name: "Jordan Kim",
      instrument: "Bass",
      mood: "Content",
      chemistry: 72,
      skill: 88,
      loyalty: 85,
      energy: 75,
      avatar: "🎵",
      personality: "Steady",
      issues: ["Wants more creative input"],
      strengths: ["Solid rhythm", "Reliable", "Good communicator"]
    },
    {
      id: 3,
      name: "Sam Taylor",
      instrument: "Drums",
      mood: "Frustrated",
      chemistry: 45,
      skill: 85,
      loyalty: 60,
      energy: 50,
      avatar: "🥁",
      personality: "Intense",
      issues: ["Creative differences", "Wants higher pay", "Schedule conflicts"],
      strengths: ["Powerful beats", "Technical precision", "High energy"]
    },
    {
      id: 4,
      name: "Riley Chen",
      instrument: "Keyboards",
      mood: "Excited",
      chemistry: 95,
      skill: 90,
      loyalty: 92,
      energy: 85,
      avatar: "🎹",
      personality: "Harmonious",
      issues: [],
      strengths: ["Musical theory", "Arrangement skills", "Positive attitude"]
    }
  ];

  const teamEvents = [
    {
      id: 1,
      name: "Band Dinner",
      cost: 200,
      moraleBenefit: 15,
      chemistryBenefit: 10,
      duration: "2 hours",
      description: "Casual dinner to bond and discuss music"
    },
    {
      id: 2,
      name: "Studio Jam Session",
      cost: 500,
      moraleBenefit: 20,
      chemistryBenefit: 25,
      duration: "4 hours",
      description: "Free-form creative session to build musical chemistry"
    },
    {
      id: 3,
      name: "Team Building Retreat",
      cost: 2000,
      moraleBenefit: 35,
      chemistryBenefit: 40,
      duration: "2 days",
      description: "Weekend retreat focused on communication and collaboration"
    }
  ];

  const recentConflicts = [
    {
      id: 1,
      type: "Creative Difference",
      members: ["Alex Rivera", "Sam Taylor"],
      severity: "Medium",
      description: "Disagreement over song arrangement for new single",
      timeAgo: "2 days ago",
      resolved: false
    },
    {
      id: 2,
      type: "Schedule Conflict",
      members: ["Sam Taylor"],
      severity: "Low",
      description: "Wants different rehearsal times due to side job",
      timeAgo: "1 week ago",
      resolved: false
    }
  ];

  const handleTeamEvent = (event: any) => {
    toast({
      title: "Team Event Scheduled!",
      description: `${event.name} will improve band chemistry and morale.`,
    });
  };

  const handleResolveConflict = (conflictId: number) => {
    toast({
      title: "Conflict Resolved!",
      description: "The band conflict has been successfully mediated.",
    });
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case "Motivated": return "text-green-400";
      case "Excited": return "text-blue-400";
      case "Content": return "text-yellow-400";
      case "Frustrated": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const getChemistryColor = (chemistry: number) => {
    if (chemistry >= 80) return "text-green-400";
    if (chemistry >= 60) return "text-yellow-400";
    if (chemistry >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High": return "bg-red-500";
      case "Medium": return "bg-yellow-500";
      case "Low": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            BAND CHEMISTRY
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Manage relationships and keep the band together
          </p>
          <div className="flex justify-center items-center gap-4">
            <div className="flex items-center gap-2 text-cream">
              <Heart className="h-6 w-6" />
              <span className="text-lg">Band Morale: {bandMorale}/100</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            <TabsTrigger value="events">Team Events</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bandMembers.map((member) => (
                <Card key={member.id} className="bg-card/80 border-accent">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{member.avatar}</div>
                        <div>
                          <CardTitle className="text-cream">{member.name}</CardTitle>
                          <CardDescription>{member.instrument}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">
                          {member.personality}
                        </Badge>
                        <p className={`text-sm font-semibold ${getMoodColor(member.mood)}`}>
                          {member.mood}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Chemistry</span>
                            <span className={`font-bold ${getChemistryColor(member.chemistry)}`}>
                              {member.chemistry}%
                            </span>
                          </div>
                          <Progress value={member.chemistry} className="h-2" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Skill</span>
                            <span className="text-accent font-bold">{member.skill}%</span>
                          </div>
                          <Progress value={member.skill} className="h-2" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Loyalty</span>
                            <span className="text-accent font-bold">{member.loyalty}%</span>
                          </div>
                          <Progress value={member.loyalty} className="h-2" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-cream/60 text-sm">Energy</span>
                            <span className="text-accent font-bold">{member.energy}%</span>
                          </div>
                          <Progress value={member.energy} className="h-2" />
                        </div>
                      </div>
                    </div>

                    {member.issues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-cream/60 text-sm flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Current Issues
                        </p>
                        <div className="space-y-1">
                          {member.issues.map((issue, index) => (
                            <Badge key={index} variant="destructive" className="text-xs mr-1">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-cream/60 text-sm flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        Strengths
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {member.strengths.map((strength, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-accent hover:bg-accent/80 text-background"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Talk
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-accent text-accent hover:bg-accent/10"
                      >
                        <Coffee className="h-4 w-4 mr-1" />
                        Hang Out
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="conflicts" className="space-y-6">
            <div className="space-y-4">
              {recentConflicts.map((conflict) => (
                <Card key={conflict.id} className="bg-card/80 border-accent">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-cream">{conflict.type}</h3>
                          <Badge className={`${getSeverityColor(conflict.severity)} text-white`}>
                            {conflict.severity}
                          </Badge>
                        </div>
                        <p className="text-cream/80">{conflict.description}</p>
                        <div className="flex items-center gap-4 text-sm text-cream/60">
                          <span>Members: {conflict.members.join(", ")}</span>
                          <span>{conflict.timeAgo}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleResolveConflict(conflict.id)}
                          size="sm"
                          className="bg-accent hover:bg-accent/80 text-background"
                        >
                          Mediate
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-accent text-accent hover:bg-accent/10"
                        >
                          Investigate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {recentConflicts.length === 0 && (
              <Card className="bg-card/80 border-accent">
                <CardContent className="pt-6 text-center">
                  <Heart className="h-12 w-12 text-accent mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-cream mb-2">All Good!</h3>
                  <p className="text-cream/80">No current conflicts in the band. Keep up the great chemistry!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {teamEvents.map((event) => (
                <Card key={event.id} className="bg-card/80 border-accent">
                  <CardHeader>
                    <CardTitle className="text-cream">{event.name}</CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Cost</p>
                        <p className="text-lg font-bold text-accent">${event.cost}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Duration</p>
                        <p className="text-cream">{event.duration}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-cream/60 text-sm">Benefits</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          +{event.moraleBenefit} Morale
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          +{event.chemistryBenefit} Chemistry
                        </Badge>
                      </div>
                    </div>

                    <Button 
                      onClick={() => handleTeamEvent(event)}
                      className="w-full bg-accent hover:bg-accent/80 text-background"
                    >
                      Schedule Event
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Average Chemistry</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">74%</div>
                  <p className="text-cream/60 text-sm">Good harmony</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Active Conflicts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{recentConflicts.length}</div>
                  <p className="text-cream/60 text-sm">Need attention</p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm">Team Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">12</div>
                  <p className="text-cream/60 text-sm">This month</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Member Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bandMembers.map((member) => (
                    <div key={member.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{member.avatar}</span>
                          <span className="text-cream font-semibold">{member.name}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${getChemistryColor(member.chemistry)}`}>
                            {member.chemistry}% Chemistry
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-cream/60">Skill: </span>
                          <span className="text-accent">{member.skill}%</span>
                        </div>
                        <div>
                          <span className="text-cream/60">Loyalty: </span>
                          <span className="text-accent">{member.loyalty}%</span>
                        </div>
                        <div>
                          <span className="text-cream/60">Energy: </span>
                          <span className="text-accent">{member.energy}%</span>
                        </div>
                        <div>
                          <span className="text-cream/60">Issues: </span>
                          <span className={member.issues.length > 0 ? "text-red-400" : "text-green-400"}>
                            {member.issues.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BandChemistry;