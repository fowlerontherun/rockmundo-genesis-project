import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SafetyActions } from "@/components/social-safety/SafetyActions";
import { BookOpen, GraduationCap, RefreshCw, ShieldCheck, Users } from "lucide-react";

const skillLabel = (slug?: string | null) =>
  (slug ?? "skill")
    .replace(/^teaching_/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value?: string | null) => {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
};

type SkillProgress = { skill_slug: string; current_level: number | null; current_xp: number | null };
type MentorProfile = {
  headline: string | null;
  focus_areas: string[] | null;
  is_open_to_mentor: boolean | null;
  max_active_mentees: number;
  mentor_capacity: number | null;
};
type Mentor = {
  mentorship_profile_id: string;
  profile_id: string;
  display_name: string | null;
  username: string;
  headline: string | null;
  mentorship_style: string | null;
  focus_areas: string[] | null;
  max_active_mentees: number;
  active_mentees: number;
  strongest_level: number | null;
};
type Mentorship = {
  id: string;
  mentor_player_profile_id: string;
  mentee_profile_id: string;
  mentor_name: string | null;
  mentee_name: string | null;
  skill_slug: string | null;
  request_note: string | null;
  status: string;
  baseline_level: number | null;
  rewarded_milestones: number;
  created_at: string;
};
type PlayerClass = {
  id: string;
  teacher_profile_id: string;
  teacher_name?: string | null;
  teacher_username?: string;
  skill_slug: string;
  title: string;
  description?: string | null;
  price_minor: number;
  duration_hours: number;
  max_students: number;
  scheduled_at: string;
  status: string;
  teacher_skill_level?: number | null;
  enrolled_count?: number;
  failed_settlements?: number;
  is_enrolled?: boolean;
};
type LearningEnrolment = {
  id: string;
  class_id: string;
  title: string;
  skill_slug: string;
  price_minor: number;
  duration_hours: number;
  scheduled_at: string;
  class_status: string;
  teacher_name: string | null;
  teacher_profile_id: string;
  status: string;
  skill_xp_awarded: number;
  settlement_error?: string | null;
};

type ActionResult = { error?: { message?: string } | null };

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
};

export const PlayerLearningNetwork = () => {
  const { profile } = useGameData();
  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [classes, setClasses] = useState<PlayerClass[]>([]);
  const [myTeaching, setMyTeaching] = useState<PlayerClass[]>([]);
  const [myLearning, setMyLearning] = useState<LearningEnrolment[]>([]);
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mentorHeadline, setMentorHeadline] = useState("");
  const [mentorSkill, setMentorSkill] = useState("");
  const [mentorCapacity, setMentorCapacity] = useState("2");

  const [classSkill, setClassSkill] = useState("");
  const [classTitle, setClassTitle] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [classPrice, setClassPrice] = useState("0");
  const [classDuration, setClassDuration] = useState("1");
  const [classCapacity, setClassCapacity] = useState("4");
  const [classDate, setClassDate] = useState("");

  const teachableSkills = useMemo(
    () => skills.filter((skill) => !skill.skill_slug.startsWith("teaching_") && (skill.current_level ?? 0) >= 5),
    [skills],
  );

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const [skillResult, mentorProfileResult, mentorResult, mentorshipResult, classResult, myClassResult] = await Promise.all([
        supabase.from("skill_progress").select("skill_slug,current_level,current_xp").eq("profile_id", profile.id).order("current_level", { ascending: false }),
        supabase.from("community_mentorship_profiles").select("headline,focus_areas,is_open_to_mentor,max_active_mentees,mentor_capacity").eq("profile_id", profile.id).maybeSingle(),
        supabase.rpc("get_community_mentor_discovery", { p_profile_id: profile.id }),
        supabase.rpc("get_my_community_mentorships", { p_profile_id: profile.id }),
        supabase.rpc("get_player_education_classes", { p_profile_id: profile.id }),
        supabase.rpc("get_my_player_education_classes", { p_profile_id: profile.id }),
      ]);

      if (skillResult.error) throw skillResult.error;
      if (mentorProfileResult.error) throw mentorProfileResult.error;
      if (mentorResult.error) throw mentorResult.error;
      if (mentorshipResult.error) throw mentorshipResult.error;
      if (classResult.error) throw classResult.error;
      if (myClassResult.error) throw myClassResult.error;

      setSkills(skillResult.data ?? []);
      setMentorProfile(mentorProfileResult.data ?? null);
      setMentors((mentorResult.data ?? []) as unknown as Mentor[]);
      setMentorships((mentorshipResult.data ?? []) as unknown as Mentorship[]);
      setClasses((classResult.data ?? []) as unknown as PlayerClass[]);
      const myClasses = myClassResult.data as unknown as {
        teaching?: PlayerClass[];
        learning?: LearningEnrolment[];
      } | null;
      setMyTeaching(myClasses?.teaching ?? []);
      setMyLearning(myClasses?.learning ?? []);

      if (mentorProfileResult.data) {
        setMentorHeadline(mentorProfileResult.data.headline ?? "");
        setMentorCapacity(String(mentorProfileResult.data.max_active_mentees ?? mentorProfileResult.data.mentor_capacity ?? 2));
        setMentorSkill(mentorProfileResult.data.focus_areas?.[0] ?? "");
      }
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Could not load player learning network."));
    } finally {
      setBusy(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => PromiseLike<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action() as ActionResult;
      if (result.error) throw result.error;
      setMessage(success);
      await load();
    } catch (error: unknown) {
      setMessage(errorMessage(error, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5 text-primary" /> Player Learning Network
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Find verified mentors, track real learning milestones, or teach bounded player classes using your existing skills.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {message && <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{message}</div>}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex gap-3 pt-5 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            Mentoring is optional and penalty-free to leave. Mentor rewards only unlock after verified skill levels improve. Blocks apply to discovery, requests and classes; class rewards require server-timed check-in and completion.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="mentors" className="space-y-5">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mentors">Mentors</TabsTrigger>
          <TabsTrigger value="relationships">My Mentorships</TabsTrigger>
          <TabsTrigger value="classes">Player Classes</TabsTrigger>
        </TabsList>

        <TabsContent value="mentors" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Offer mentorship</CardTitle>
              <CardDescription>Opt in with a skill you have already reached level 5 in. Capacity is capped at three active mentees.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mentor-headline">Headline</Label>
                <Input id="mentor-headline" value={mentorHeadline} onChange={(event) => setMentorHeadline(event.target.value)} placeholder="Friendly guitar coach for new bands" maxLength={160} />
              </div>
              <div className="space-y-2">
                <Label>Skill</Label>
                <Select value={mentorSkill} onValueChange={setMentorSkill}>
                  <SelectTrigger><SelectValue placeholder="Choose a verified skill" /></SelectTrigger>
                  <SelectContent>
                    {teachableSkills.map((skill) => <SelectItem key={skill.skill_slug} value={skill.skill_slug}>{skillLabel(skill.skill_slug)} · Lv {skill.current_level}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Select value={mentorCapacity} onValueChange={setMentorCapacity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3].map((value) => <SelectItem key={value} value={String(value)}>{value} mentee{value > 1 ? "s" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  disabled={busy || !mentorSkill}
                  onClick={() => void run(() => supabase.rpc("set_community_mentorship_profile", {
                    p_profile_id: profile.id,
                    p_is_open: true,
                    p_headline: mentorHeadline,
                    p_style: "supportive",
                    p_skill_slugs: [mentorSkill],
                    p_capacity: Number(mentorCapacity),
                  }), "Mentor profile is open.")}
                >{mentorProfile?.is_open_to_mentor ? "Update mentor profile" : "Open mentor profile"}</Button>
                {mentorProfile?.is_open_to_mentor && (
                  <Button variant="outline" disabled={busy} onClick={() => void run(() => supabase.rpc("set_community_mentorship_profile", {
                    p_profile_id: profile.id,
                    p_is_open: false,
                    p_headline: mentorHeadline,
                    p_style: "supportive",
                    p_skill_slugs: mentorSkill ? [mentorSkill] : [],
                    p_capacity: Number(mentorCapacity),
                  }), "Mentor profile closed.")}>Close</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mentors.map((mentor) => {
              const focus = mentor.focus_areas?.[0];
              return (
                <Card key={mentor.mentorship_profile_id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{mentor.display_name || mentor.username}</CardTitle>
                      <Badge variant="outline">{mentor.active_mentees}/{mentor.max_active_mentees}</Badge>
                    </div>
                    <CardDescription>{mentor.headline || "Open to helping developing players."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Focus</span><span>{skillLabel(focus)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Verified peak</span><span>Lv {mentor.strongest_level ?? "?"}</span></div>
                    <div className="flex flex-wrap gap-2">
                      <Button className="min-w-40 flex-1" disabled={busy || !focus} onClick={() => void run(() => supabase.rpc("request_community_mentorship", {
                        p_mentee_profile_id: profile.id,
                        p_mentor_profile_id: mentor.profile_id,
                        p_skill_slug: focus,
                        p_note: "I'd like help improving this skill.",
                      }), "Mentorship request sent.")}>Request mentorship</Button>
                      <SafetyActions
                        compact
                        targetProfileId={mentor.profile_id}
                        targetName={mentor.display_name || mentor.username}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!mentors.length && !busy && <p className="text-sm text-muted-foreground">No eligible mentors are available right now.</p>}
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          {mentorships.map((match) => {
            const amMentor = match.mentor_player_profile_id === profile.id;
            const counterpart = amMentor ? match.mentee_name : match.mentor_name;
            const counterpartProfileId = amMentor ? match.mentee_profile_id : match.mentor_player_profile_id;
            return (
              <Card key={match.id}>
                <CardContent className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{counterpart || "Player"}</span><Badge>{match.status}</Badge><Badge variant="outline">{skillLabel(match.skill_slug)}</Badge></div>
                    <p className="text-xs text-muted-foreground">{amMentor ? "You are mentoring" : "Your mentor"} · {match.rewarded_milestones}/3 verified milestones rewarded</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {amMentor && match.status === "pending" && <>
                      <Button size="sm" disabled={busy} onClick={() => void run(() => supabase.rpc("respond_community_mentorship", { p_match_id: match.id, p_accept: true }), "Mentorship accepted.")}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => supabase.rpc("respond_community_mentorship", { p_match_id: match.id, p_accept: false }), "Mentorship declined.")}>Decline</Button>
                    </>}
                    {match.status === "active" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => supabase.rpc("process_community_mentorship_progress", { p_match_id: match.id }), "Verified learning progress checked.")}>Check milestones</Button>}
                    {(match.status === "pending" || match.status === "active") && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => supabase.rpc("leave_community_mentorship", { p_match_id: match.id }), "Mentorship ended with no penalty.")}>Leave</Button>}
                    <SafetyActions
                      compact
                      targetProfileId={counterpartProfileId}
                      targetName={counterpart || "this player"}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!mentorships.length && !busy && <p className="text-sm text-muted-foreground">You do not have any mentorship requests or relationships yet.</p>}
        </TabsContent>

        <TabsContent value="classes" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" /> Run a player class</CardTitle>
              <CardDescription>Requires a teaching skill plus level 5+ in the subject. Prices are capped at $500 and rewards settle only after verified attendance.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2"><Label>Subject</Label><Select value={classSkill} onValueChange={setClassSkill}><SelectTrigger><SelectValue placeholder="Choose skill" /></SelectTrigger><SelectContent>{teachableSkills.map((skill) => <SelectItem key={skill.skill_slug} value={skill.skill_slug}>{skillLabel(skill.skill_slug)} · Lv {skill.current_level}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Title</Label><Input value={classTitle} onChange={(event) => setClassTitle(event.target.value)} maxLength={80} placeholder="Rhythm Guitar Workshop" /></div>
              <div className="space-y-2"><Label>Starts</Label><Input type="datetime-local" value={classDate} onChange={(event) => setClassDate(event.target.value)} /></div>
              <div className="space-y-2"><Label>Price ($0–500)</Label><Input type="number" min="0" max="500" value={classPrice} onChange={(event) => setClassPrice(event.target.value)} /></div>
              <div className="space-y-2"><Label>Duration</Label><Select value={classDuration} onValueChange={setClassDuration}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4].map((value) => <SelectItem key={value} value={String(value)}>{value} hour{value > 1 ? "s" : ""}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Seats</Label><Select value={classCapacity} onValueChange={setClassCapacity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3"><Label>Description</Label><Textarea value={classDescription} onChange={(event) => setClassDescription(event.target.value)} maxLength={800} placeholder="What will players learn?" /></div>
              <div className="md:col-span-2 lg:col-span-3"><Button disabled={busy || !classSkill || !classTitle || !classDate} onClick={() => void run(() => supabase.rpc("create_player_education_class", {
                p_teacher_profile_id: profile.id,
                p_skill_slug: classSkill,
                p_title: classTitle,
                p_description: classDescription,
                p_price_minor: Math.round(Number(classPrice || 0) * 100),
                p_duration_hours: Number(classDuration),
                p_max_students: Number(classCapacity),
                p_scheduled_at: new Date(classDate).toISOString(),
              }), "Player class created.")}>Create class</Button></div>
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4" /> Available classes</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {classes.map((playerClass) => <Card key={playerClass.id}>
                <CardHeader><CardTitle className="text-base">{playerClass.title}</CardTitle><CardDescription>{playerClass.teacher_name || playerClass.teacher_username} · {formatDate(playerClass.scheduled_at)}</CardDescription></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Skill</span><span>{skillLabel(playerClass.skill_slug)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Teacher level</span><span>{playerClass.teacher_skill_level ?? "?"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Seats</span><span>{playerClass.enrolled_count ?? 0}/{playerClass.max_students}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>${(playerClass.price_minor / 100).toFixed(2)}</span></div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="min-w-32 flex-1" disabled={busy || playerClass.is_enrolled || playerClass.status !== "open"} onClick={() => void run(() => supabase.rpc("enrol_player_education_class", { p_class_id: playerClass.id, p_student_profile_id: profile.id }), "Enrolled in player class.")}>{playerClass.is_enrolled ? "Enrolled" : "Join class"}</Button>
                    <SafetyActions
                      compact
                      targetProfileId={playerClass.teacher_profile_id}
                      targetName={playerClass.teacher_name || playerClass.teacher_username || "this teacher"}
                    />
                  </div>
                </CardContent>
              </Card>)}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Classes you are learning in</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myLearning.map((entry) => <div key={entry.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{entry.title}</span><Badge variant="outline">{entry.status}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.teacher_name} · {skillLabel(entry.skill_slug)} · {formatDate(entry.scheduled_at)}</p>
                  {entry.settlement_error && <p className="mt-2 text-xs text-destructive">Settlement: {entry.settlement_error}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.status === "enrolled" && <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => supabase.rpc("check_in_player_education_class", { p_class_id: entry.class_id, p_student_profile_id: profile.id }), "Checked in to class.")}>Check in</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => supabase.rpc("cancel_player_education_class_enrolment", { p_class_id: entry.class_id, p_student_profile_id: profile.id }), "Class enrolment cancelled.")}>Cancel</Button>
                    </>}
                    {entry.status === "completed" && <Badge>+{entry.skill_xp_awarded} skill XP</Badge>}
                    <SafetyActions
                      compact
                      targetProfileId={entry.teacher_profile_id}
                      targetName={entry.teacher_name || "this teacher"}
                    />
                  </div>
                </div>)}
                {!myLearning.length && <p className="text-sm text-muted-foreground">No player classes booked.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Classes you are teaching</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myTeaching.map((entry) => <div key={entry.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{entry.title}</span><Badge variant="outline">{entry.status}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{skillLabel(entry.skill_slug)} · {entry.enrolled_count ?? 0}/{entry.max_students} students · {formatDate(entry.scheduled_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(entry.status === "open" || (entry.failed_settlements ?? 0) > 0) && (
                      <Button size="sm" disabled={busy} onClick={() => void run(() => supabase.rpc("complete_player_education_class", { p_class_id: entry.id, p_teacher_profile_id: profile.id }), "Class settlement processed.")}>
                        {(entry.failed_settlements ?? 0) > 0 ? "Retry settlement" : "Complete / settle"}
                      </Button>
                    )}
                    {entry.status === "open" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => supabase.rpc("cancel_player_education_class", { p_class_id: entry.id, p_teacher_profile_id: profile.id }), "Class cancelled.")}>Cancel</Button>}
                    {(entry.failed_settlements ?? 0) > 0 && <Badge variant="destructive">{entry.failed_settlements} failed</Badge>}
                  </div>
                </div>)}
                {!myTeaching.length && <p className="text-sm text-muted-foreground">You have not created a player class.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
