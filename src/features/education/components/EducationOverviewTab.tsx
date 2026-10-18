import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BookOpen, GraduationCap, TrendingUp, BookMarked, ArrowRight, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getSkillDisplayProgress } from "@/utils/skillProgressDisplay";
import { useEducationSummary } from "../hooks/useEducationSummary";
import { useSkillTierAccess, isEducationSkillVisible } from "../hooks/useSkillTierAccess";
import { formatEducationSkillName, percentComplete } from "../utils/educationUi";

export const EducationOverviewTab = () => {
  const { profileId } = useActiveProfile();
  const { skillProgress: rawSkills, loading: skillsLoading } = useGameData();
  const { activeBooks, activeEnrollments, completedEnrollments, yesterdayProgress, isLoading, hasError } = useEducationSummary();
  const tierAccess = useSkillTierAccess(profileId, (rawSkills ?? []).map((skill) => skill.skill_slug));
  const access = tierAccess.data ?? new Map<string, boolean>();

  const skills = useMemo(() => (rawSkills ?? [])
    .filter((skill) => Number(skill.current_level) > 0 && isEducationSkillVisible(skill.skill_slug, access))
    .map((skill) => ({ slug: skill.skill_slug, ...getSkillDisplayProgress(skill as any) })), [rawSkills, access]);

  const closest = useMemo(() => skills
    .filter((skill) => !skill.is_max_level && skill.xp_required_for_next_level !== null)
    .sort((a, b) => b.progress_percent - a.progress_percent)
    .slice(0, 5), [skills]);

  const suggestedSkill = closest[0] ?? null;
  const loading = isLoading || skillsLoading || tierAccess.isLoading;
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading your learning dashboard...</p>;

  return (
    <div className="space-y-6">
      {(hasError || tierAccess.isError) && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Some education or skill eligibility records could not be verified. Refresh to see an accurate learning overview.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-bold">{skills.length}</p><p className="text-xs text-muted-foreground">Skills learned</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-bold">{activeBooks.length + activeEnrollments.length}</p><p className="text-xs text-muted-foreground">In progress</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-bold">+{yesterdayProgress.totalXp.toLocaleString()}</p><p className="text-xs text-muted-foreground">XP yesterday</p></CardContent></Card>
      </div>

      <section className="space-y-3" aria-label="Current learning">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg">Continue learning</h2>
          <Button asChild size="sm" variant="outline"><Link to="/education?tab=find">Find learning <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
        {activeBooks.length === 0 && activeEnrollments.length === 0 && (
          <Card className="border-dashed"><CardContent className="py-6">
            <p className="font-medium">No learning activities underway</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a skill to find a book, university course, video or mentor.</p>
            <Button asChild className="mt-3" size="sm"><Link to="/education?tab=skills">Choose a skill</Link></Button>
          </CardContent></Card>
        )}
        {activeBooks.map((book) => {
          const targetDays = Math.max(1, book.skill_books?.base_reading_days ?? 1);
          const progress = percentComplete(book.days_read, targetDays);
          return (
            <Card key={book.id}><CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{book.skill_books?.title ?? "Current book"}</p>
                  <p className="text-xs text-muted-foreground">Book · {formatEducationSkillName(book.skill_books?.skill_slug)} · Day {book.days_read} of {targetDays}</p>
                </div>
                <Badge variant="secondary">{book.auto_read ? "Auto-reading" : "Manual reading"}</Badge>
              </div>
              <Progress value={progress} aria-label={"Book reading " + progress + "% complete"} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>+{book.total_skill_xp_earned} skill XP earned</span>
                <Button size="sm" asChild><Link to="/education?tab=find&method=books">{book.auto_read ? "Manage reading" : "Record reading"}</Link></Button>
              </div>
            </CardContent></Card>
          );
        })}
        {activeEnrollments.map((enrollment) => {
          const start = Date.parse(enrollment.enrolled_at);
          const end = enrollment.scheduled_end_date ? Date.parse(enrollment.scheduled_end_date) : NaN;
          const scheduledDays = Number.isFinite(start) && Number.isFinite(end) && end > start
            ? Math.max(1, Math.ceil((end - start) / 86400000))
            : Math.max(1, enrollment.university_courses?.base_duration_days ?? 1);
          const progress = percentComplete(enrollment.days_attended, scheduledDays);
          return (
            <Card key={enrollment.id}><CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{enrollment.university_courses?.name ?? "Current course"}</p>
                  <p className="text-xs text-muted-foreground">{enrollment.universities?.name ?? "University"} · Day {enrollment.days_attended} of {scheduledDays}</p>
                </div>
                <Badge variant="secondary">{enrollment.auto_attend ? "Auto-attend" : "Manual attendance"}</Badge>
              </div>
              <Progress value={progress} aria-label={"University course " + progress + "% complete"} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>+{enrollment.total_xp_earned} skill XP earned</span>
                <Button size="sm" asChild><Link to={"/university/" + enrollment.university_id}>Manage course</Link></Button>
              </div>
            </CardContent></Card>
          );
        })}
      </section>

      <section className="space-y-3" aria-label="Skill progress">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">My skills</h2>
          <Button variant="link" size="sm" asChild><Link to="/education?tab=skills">View all skills</Link></Button>
        </div>
        <Card><CardContent className="p-4 space-y-4">
          {closest.length === 0 ? <p className="text-sm text-muted-foreground">Learn a skill to start tracking progress towards the next level.</p> : closest.map((skill) => (
            <div key={skill.slug} className="space-y-1.5">
              <div className="flex justify-between text-sm gap-2">
                <span className="font-medium">{formatEducationSkillName(skill.slug)}</span>
                <span className="text-muted-foreground">Level {skill.current_level} · {Math.round(skill.progress_percent)}%</span>
              </div>
              <Progress value={skill.progress_percent} aria-label={formatEducationSkillName(skill.slug) + " " + Math.round(skill.progress_percent) + "% towards next level"} />
            </div>
          ))}
        </CardContent></Card>
      </section>

      {suggestedSkill && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="flex gap-2 items-center text-base"><TrendingUp className="h-4 w-4" /> Recommended next</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Improve <strong>{formatEducationSkillName(suggestedSkill.slug)}</strong>. You are {Math.round(suggestedSkill.progress_percent)}% of the way to level {suggestedSkill.next_level}. It is one of your closest achievable level-ups.</p>
            <Button asChild size="sm"><Link to={"/education?tab=find&skill=" + encodeURIComponent(suggestedSkill.slug)}>Find ways to learn <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      )}

      {completedEnrollments.length > 0 && (
        <section className="space-y-2" aria-label="Recent achievements">
          <h2 className="font-semibold text-lg">Recent achievements</h2>
          {completedEnrollments.slice(0, 3).map((enrollment) => (
            <div key={enrollment.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1">{enrollment.university_courses?.name ?? "Completed course"}</span>
              <span className="text-muted-foreground">+{enrollment.total_xp_earned} XP</span>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <BookMarked className="h-4 w-4" />
        <span>Skill progress reflects earned XP. Completing a book or course is a separate milestone.</span>
      </div>
    </div>
  );
};
