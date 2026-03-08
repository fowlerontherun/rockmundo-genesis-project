import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, GraduationCap, Users, Clock, Star, Award } from "lucide-react";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { useTeaching } from "@/hooks/useTeaching";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { useMergedSkillDefinitions } from "@/utils/skillDefinitions";
import { toast } from "@/hooks/use-toast";

function TeachingInner() {
  const {
    teachingTier,
    canTeach,
    getTeachableSkills,
    startTeachingSession,
    activeSessions,
    completedSessions,
    loading,
    friendProfiles,
    tierConfig,
  } = useTeaching();

  const { definitions, progress } = useSkillSystem();
  const { map: skillMap } = useMergedSkillDefinitions(definitions);

  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [selectedFriend, setSelectedFriend] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<string>("3");
  const [isStarting, setIsStarting] = useState(false);

  const teachableSkills = getTeachableSkills();
  const friendList = Object.values(friendProfiles);

  const handleStartSession = async () => {
    if (!selectedSkill || !selectedFriend) return;
    setIsStarting(true);
    const session = await startTeachingSession(selectedFriend, selectedSkill, parseInt(selectedDuration));
    setIsStarting(false);

    if (session) {
      toast({ title: "Teaching Session Started!", description: `You're now teaching ${skillMap.get(selectedSkill)?.displayName ?? selectedSkill}` });
      setSelectedSkill("");
      setSelectedFriend("");
    } else {
      toast({ title: "Failed to start session", variant: "destructive" });
    }
  };

  const getSkillName = (slug: string) => skillMap.get(slug)?.displayName ?? slug;

  const getProfileName = (profileId: string) => {
    const p = friendProfiles[profileId];
    return p ? (p.display_name || p.username) : profileId.slice(0, 8);
  };

  if (!teachingTier) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Teaching
            </CardTitle>
            <CardDescription>
              Unlock the Teaching skill tree to teach your skills to friends and earn bonus XP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Teaching Not Unlocked</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You need to unlock the <strong>Basic Teaching</strong> skill to start teaching other players.
                Visit the Skills page to unlock it.
              </p>
              <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                <p>🎓 <strong>Basic Teaching</strong> — Students earn 50-80 XP/day</p>
                <p>📚 <strong>Professional Teaching</strong> — Students earn 70-100 XP/day</p>
                <p>🏆 <strong>Mastery Teaching</strong> — Students earn 90-120 XP/day + group teaching</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Teaching
          </h1>
          <p className="text-muted-foreground mt-1">
            Teach your skills to friends — both of you earn XP!
          </p>
        </div>
        <Badge variant="outline" className="text-sm capitalize">
          {teachingTier} Tier
        </Badge>
      </div>

      {tierConfig && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Student XP/day</p>
                <p className="font-bold text-primary">{tierConfig.studentXpRange[0]}-{tierConfig.studentXpRange[1]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teacher XP/day</p>
                <p className="font-bold text-primary">{tierConfig.teacherXpRange[0]}-{tierConfig.teacherXpRange[1]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Min Skill Level</p>
                <p className="font-bold">{tierConfig.minSkillLevel}+</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Students</p>
                <p className="font-bold">{tierConfig.maxStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="teach">
        <TabsList className="w-full">
          <TabsTrigger value="teach" className="flex-1">
            <BookOpen className="h-4 w-4 mr-1" /> Teach
          </TabsTrigger>
          <TabsTrigger value="learn" className="flex-1">
            <Users className="h-4 w-4 mr-1" /> Active Sessions
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            <Clock className="h-4 w-4 mr-1" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teach">
          <Card>
            <CardHeader>
              <CardTitle>Start a Teaching Session</CardTitle>
              <CardDescription>
                Choose a skill to teach and a friend to learn it. Both of you earn XP daily — more than university!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {teachableSkills.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No skills high enough to teach. Level up your skills to start teaching!
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Skill to Teach</label>
                    <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a skill..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teachableSkills.map((slug) => (
                          <SelectItem key={slug} value={slug}>
                            {getSkillName(slug)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Friend to Teach</label>
                    <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a friend..." />
                      </SelectTrigger>
                      <SelectContent>
                        {friendList.length === 0 ? (
                          <SelectItem value="none" disabled>No friends found</SelectItem>
                        ) : (
                          friendList.map((friend) => (
                            <SelectItem key={friend.id} value={friend.id}>
                              {friend.display_name || friend.username}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (days)</label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 5, 7].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d} {d === 1 ? "day" : "days"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleStartSession}
                    disabled={!selectedSkill || !selectedFriend || isStarting}
                    className="w-full"
                  >
                    {isStarting ? "Starting..." : "Start Teaching Session"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learn">
          <div className="space-y-3">
            {activeSessions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active teaching sessions.
                </CardContent>
              </Card>
            ) : (
              activeSessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{getSkillName(session.skill_slug)}</p>
                        <p className="text-sm text-muted-foreground">
                          Teacher: {getProfileName(session.teacher_profile_id)} → Student: {getProfileName(session.student_profile_id)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge>{session.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.session_duration_days}d • +{session.student_xp_earned} XP (student) • +{session.teacher_xp_earned} XP (teacher)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {completedSessions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No completed teaching sessions yet.
                </CardContent>
              </Card>
            ) : (
              completedSessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{getSkillName(session.skill_slug)}</p>
                        <p className="text-sm text-muted-foreground">
                          {getProfileName(session.teacher_profile_id)} → {getProfileName(session.student_profile_id)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 text-warning" />
                          <span>+{session.student_xp_earned} / +{session.teacher_xp_earned} XP</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{session.session_duration_days} days</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Teaching() {
  return (
    <SkillSystemProvider>
      <TeachingInner />
    </SkillSystemProvider>
  );
}
