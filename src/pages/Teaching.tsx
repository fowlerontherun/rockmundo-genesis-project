import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BookOpen, GraduationCap, Users, Clock, Star, XCircle, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { useTeaching, TIER_CONFIG, type TeachingSession } from "@/hooks/useTeaching";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { useMergedSkillDefinitions } from "@/utils/skillDefinitions";
import { toast } from "@/hooks/use-toast";

function TeachingInner() {
  const {
    teachingTier,
    getTeachableSkills,
    getSkillLevel,
    calculateXp,
    validateSession,
    startTeachingSession,
    cancelSession,
    activeSessions,
    completedSessions,
    cancelledSessions,
    loading,
    friendsLoading,
    friendProfiles,
    activeTeachingCount,
    tierConfig,
    getSessionProgress,
    getTimeRemaining,
  } = useTeaching();

  const { definitions, progress } = useSkillSystem();
  const { map: skillMap } = useMergedSkillDefinitions(definitions);

  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [selectedFriend, setSelectedFriend] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<string>("3");
  const [isStarting, setIsStarting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const teachableSkills = getTeachableSkills();
  const friendList = Object.values(friendProfiles);

  // Pre-validate selected session
  const preValidation = useMemo(() => {
    if (!selectedSkill || !selectedFriend) return null;
    return validateSession(selectedFriend, selectedSkill);
  }, [selectedSkill, selectedFriend, validateSession]);

  // Calculate preview XP for selected options
  const xpPreview = useMemo(() => {
    if (!selectedSkill || !teachingTier) return null;
    const level = getSkillLevel(selectedSkill);
    return calculateXp(teachingTier, level);
  }, [selectedSkill, teachingTier, getSkillLevel, calculateXp]);

  const handleStartSession = async () => {
    if (!selectedSkill || !selectedFriend) return;
    setIsStarting(true);
    const { session, error } = await startTeachingSession(selectedFriend, selectedSkill, parseInt(selectedDuration));
    setIsStarting(false);

    if (session) {
      toast({
        title: "Teaching Session Started!",
        description: `You're now teaching ${getSkillName(selectedSkill)} for ${selectedDuration} days`,
      });
      setSelectedSkill("");
      setSelectedFriend("");
    } else {
      toast({ title: "Failed to start session", description: error ?? "Unknown error", variant: "destructive" });
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    setCancellingId(sessionId);
    const success = await cancelSession(sessionId);
    setCancellingId(null);

    if (success) {
      toast({ title: "Session Cancelled", description: "The teaching session has been cancelled." });
    } else {
      toast({ title: "Failed to cancel", variant: "destructive" });
    }
  };

  const getSkillName = (slug: string) => skillMap.get(slug)?.displayName ?? slug;

  const getProfileName = (profileId: string) => {
    const p = friendProfiles[profileId];
    return p ? (p.display_name || p.username) : profileId.slice(0, 8);
  };

  const getRoleBadge = (session: TeachingSession, myProfileId: string | undefined) => {
    if (!myProfileId) return null;
    if (session.teacher_profile_id === myProfileId) {
      return <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Teaching</Badge>;
    }
    return <Badge variant="outline" className="text-xs bg-accent/50 text-accent-foreground border-accent/30">Learning</Badge>;
  };

  // ---- UNLOCKED STATE ----
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
              <div className="mt-6 space-y-3 text-left max-w-sm mx-auto">
                {(["basic", "professional", "mastery"] as const).map((tier) => {
                  const config = TIER_CONFIG[tier];
                  return (
                    <Card key={tier} className="border-border/50">
                      <CardContent className="py-3 px-4">
                        <p className="font-medium text-sm">{config.label} Teaching</p>
                        <p className="text-xs text-muted-foreground">
                          Student: {config.studentXpRange[0]}-{config.studentXpRange[1]} XP/day •
                          Teacher: {config.teacherXpRange[0]}-{config.teacherXpRange[1]} XP/day •
                          {config.maxStudents} student{config.maxStudents > 1 ? "s" : ""} max
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requires skill level {config.minSkillLevel}+ to teach
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                <Info className="h-3 w-3 inline mr-1" />
                University awards 15-95 XP/day. Teaching surpasses that at every tier!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileId = progress.length > 0 ? progress[0]?.profile_id : undefined;

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
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

      {/* Tier stats card */}
      {tierConfig && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
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
              <div>
                <p className="text-xs text-muted-foreground">Active / Max</p>
                <p className={`font-bold ${activeTeachingCount >= tierConfig.maxStudents ? "text-destructive" : ""}`}>
                  {activeTeachingCount} / {tierConfig.maxStudents}
                </p>
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
          <TabsTrigger value="active" className="flex-1">
            <Users className="h-4 w-4 mr-1" /> Active ({activeSessions.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            <Clock className="h-4 w-4 mr-1" /> History ({completedSessions.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== TEACH TAB ===== */}
        <TabsContent value="teach">
          <Card>
            <CardHeader>
              <CardTitle>Start a Teaching Session</CardTitle>
              <CardDescription>
                Choose a skill and a friend. Both of you earn XP daily — more than university!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading || friendsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : teachableSkills.length === 0 ? (
                <div className="text-center py-6">
                  <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    No skills high enough to teach (need level {tierConfig?.minSkillLevel ?? 5}+).
                    Level up your skills to start teaching!
                  </p>
                </div>
              ) : (
                <>
                  {/* Skill selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Skill to Teach</label>
                    <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a skill..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teachableSkills.map(({ slug, level }) => (
                          <SelectItem key={slug} value={slug}>
                            {getSkillName(slug)} (Lv. {level})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Friend selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Friend to Teach</label>
                    <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a friend..." />
                      </SelectTrigger>
                      <SelectContent>
                        {friendList.length === 0 ? (
                          <SelectItem value="none" disabled>No friends found — add friends first!</SelectItem>
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

                  {/* Duration selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration</label>
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

                  {/* XP Preview */}
                  {xpPreview && selectedSkill && (
                    <Card className="border-border/50 bg-muted/30">
                      <CardContent className="py-3">
                        <p className="text-sm font-medium mb-1">XP Preview ({selectedDuration} days)</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Student earns:</span>{" "}
                            <span className="font-semibold text-primary">{xpPreview.studentXpPerDay * parseInt(selectedDuration)} XP</span>
                            <span className="text-xs text-muted-foreground"> ({xpPreview.studentXpPerDay}/day)</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">You earn:</span>{" "}
                            <span className="font-semibold text-primary">{xpPreview.teacherXpPerDay * parseInt(selectedDuration)} XP</span>
                            <span className="text-xs text-muted-foreground"> ({xpPreview.teacherXpPerDay}/day)</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Validation error display */}
                  {preValidation && !preValidation.valid && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{preValidation.error}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleStartSession}
                    disabled={!selectedSkill || !selectedFriend || isStarting || (preValidation !== null && !preValidation.valid)}
                    className="w-full"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      "Start Teaching Session"
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ACTIVE SESSIONS TAB ===== */}
        <TabsContent value="active">
          <div className="space-y-3">
            {activeSessions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No active teaching sessions.</p>
                  <p className="text-xs mt-1">Start one from the Teach tab!</p>
                </CardContent>
              </Card>
            ) : (
              activeSessions.map((session) => {
                const sessionProgress = getSessionProgress(session);
                const timeRemaining = getTimeRemaining(session);

                return (
                  <Card key={session.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{getSkillName(session.skill_slug)}</p>
                            {getRoleBadge(session, profileId)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {getProfileName(session.teacher_profile_id)} → {getProfileName(session.student_profile_id)}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive flex-shrink-0"
                              disabled={cancellingId === session.id}
                            >
                              {cancellingId === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Teaching Session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel the session for {getSkillName(session.skill_slug)}.
                                Any XP already earned will be lost.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Session</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleCancelSession(session.id)}>
                                Cancel Session
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{session.session_duration_days}d session</span>
                          <span>{timeRemaining}</span>
                        </div>
                        <Progress value={sessionProgress} className="h-2" />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Student: +{session.student_xp_earned} XP total</span>
                        <span>Teacher: +{session.teacher_xp_earned} XP total</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history">
          <div className="space-y-3">
            {completedSessions.length === 0 && cancelledSessions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No completed teaching sessions yet.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {completedSessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <p className="font-medium">{getSkillName(session.skill_slug)}</p>
                            {getRoleBadge(session, profileId)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {getProfileName(session.teacher_profile_id)} → {getProfileName(session.student_profile_id)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-3 w-3 text-warning" />
                            <span>+{session.student_xp_earned} / +{session.teacher_xp_earned} XP</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{session.session_duration_days} days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {cancelledSessions.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider pt-2">Cancelled</p>
                    {cancelledSessions.map((session) => (
                      <Card key={session.id} className="opacity-60">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                              <p className="text-sm">{getSkillName(session.skill_slug)}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">Cancelled</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </>
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
