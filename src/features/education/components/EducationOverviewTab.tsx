import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, BookOpen, GraduationCap, BookMarked, ArrowRight, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getSkillDisplayProgress } from "@/utils/skillProgressDisplay";
import { useEducationSkillDefinitions } from "../hooks/useEducationSkillDefinitions";
import { useEducationSummary } from "../hooks/useEducationSummary";
import { useBookReading } from "@/hooks/useBookReading";
import { useSkillTierAccess, isEducationSkillVisible } from "../hooks/useSkillTierAccess";
import { formatEducationSkillName, percentComplete } from "../utils/educationUi";
import { EducationRecommendations } from "./EducationRecommendations";

export const EducationOverviewTab = () => {
  const { profileId } = useActiveProfile();
  const { skillProgress: rawSkills, loading: skillsLoading } = useGameData();
  const definitions = useEducationSkillDefinitions();
  const { activeBooks, activeEnrollments, completedEnrollments, yesterdayProgress, todayAttendance, todayAttendanceVerified, isLoading, hasError } = useEducationSummary();
  const { processAttendance: recordReading, isProcessing: recordingReading } = useBookReading();
  // Progress rows alone do not include unstarted course/book skills. Query every
  // referenced skill before displaying any catalogue or legacy learning activity.
  const relevantSkillSlugs = [
    ...(rawSkills ?? []).map((skill) => skill.skill_slug),
    ...activeBooks.map((book) => book.skill_books?.skill_slug),
    ...activeEnrollments.map((enrollment) => enrollment.university_courses?.skill_slug),
    ...completedEnrollments.map((enrollment) => enrollment.university_courses?.skill_slug),
  ];
  const tierAccess = useSkillTierAccess(profileId, relevantSkillSlugs);
  const access = tierAccess.data ?? new Map<string, boolean>();
  const visibleBooks = activeBooks.filter((book) => isEducationSkillVisible(book.skill_books?.skill_slug || "__unverified__", access));
  const visibleEnrollments = activeEnrollments.filter((enrollment) => isEducationSkillVisible(enrollment.university_courses?.skill_slug || "__unverified__", access));
  const visibleCompleted = completedEnrollments.filter((enrollment) => isEducationSkillVisible(enrollment.university_courses?.skill_slug || "__unverified__", access));
  const hiddenActiveCount = activeBooks.length + activeEnrollments.length - visibleBooks.length - visibleEnrollments.length;

  const skills = useMemo(() => {
    const maxBySlug = new Map((definitions.data ?? []).map((definition) => [definition.slug, definition.max_level]));
    return (rawSkills ?? [])
      .filter((skill) => Number(skill.current_level) > 0 && isEducationSkillVisible(skill.skill_slug, access))
      .map((skill) => {
        const progress = getSkillDisplayProgress(skill as any);
        const maxed = progress.current_level >= (maxBySlug.get(skill.skill_slug) ?? Number.POSITIVE_INFINITY);
        return { slug: skill.skill_slug, ...progress, ...(maxed ? { is_max_level: true, next_level: null, progress_percent: 100 } : {}) };
      });
  }, [rawSkills, access, definitions.data]);

  const closest = useMemo(() => skills
    .filter((skill) => !skill.is_max_level && skill.xp_required_for_next_level !== null)
    .sort((a, b) => b.progress_percent - a.progress_percent)
    .slice(0, 5), [skills]);

  const loading = isLoading || skillsLoading || tierAccess.isLoading || definitions.isLoading;
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading your learning dashboard...</p>;

  return (
    <div className="space-y-6">
      {(hasError || tierAccess.isError || definitions.isError) && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Some education or skill eligibility records could not be verified. Refresh to see an accurate learning overview.</AlertDescription>
        </Alert>
      )}

      {hiddenActiveCount > 0 && !tierAccess.isLoading && !tierAccess.isError && (
        <Alert role="status"><AlertDescription>Some legacy learning activities need additional skill prerequisites before they can continue. You can manage existing reading or courses from Find Learning.</AlertDescription></Alert>
      )}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-bold">{skills.length}</p><p className="text-xs text-muted-foreground">Skills learned</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-bold">{visibleBooks.length + visibleEnrollments.length}</p><p className="text-xs text-muted-foreground">In progress</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-bold">+{yesterdayProgress.totalXp.toLocaleString()}</p><p className="text-xs text-muted-foreground">XP yesterday</p></CardContent></Card>
      </div>

      <section className="space-y-3" aria-label="Current learning">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-lg">Continue learning</h2>
          <Button asChild size="sm" variant="outline"><Link to="/education?tab=find">Find learning <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
        </div>
        {visibleBooks.length === 0 && visibleEnrollments.length === 0 && (
          <Card className="border-dashed"><CardContent className="py-6">
            <p className="font-medium">No learning activities underway</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a skill to find a book, university course, video or mentor.</p>
            <Button asChild className="mt-3" size="sm"><Link to="/education?tab=skills">Choose a skill</Link></Button>
          </CardContent></Card>
        )}
        {visibleBooks.map((book) => {
          const recordedToday = todayAttendance.bookSessionIds.includes(book.id);
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
                <Badge variant={recordedToday ? "default" : "secondary"}>
                  {!todayAttendanceVerified ? "Checking today" : recordedToday ? "Recorded today" : book.auto_read ? "Auto-reading scheduled" : "Ready to read"}
                </Badge>
              </div>
              <Progress value={progress} aria-label={"Book reading " + progress + "% complete"} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>+{book.total_skill_xp_earned} skill XP earned</span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!book.auto_read && (
                    <Button size="sm" onClick={() => recordReading()} disabled={!todayAttendanceVerified || recordedToday || recordingReading} aria-label={"Record today's reading: " + (book.skill_books?.title ?? "Book")}>
                      {recordingReading ? "Recording..." : recordedToday ? "Done today" : "Record today"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild><Link to="/education?tab=find&method=books">Manage book</Link></Button>
                </div>
              </div>
            </CardContent></Card>
          );
        })}
        {visibleEnrollments.map((enrollment) => {
          const attendedToday = todayAttendance.universityEnrollmentIds.includes(enrollment.id);
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
                <Badge variant={attendedToday ? "default" : "secondary"}>
                  {!todayAttendanceVerified ? "Checking today" : attendedToday ? "Attended today" : enrollment.auto_attend ? "Auto-attend scheduled" : "Class not yet attended"}
                </Badge>
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

      <EducationRecommendations activeSkills={[
        ...activeBooks.map((book) => book.skill_books?.skill_slug).filter((slug): slug is string => Boolean(slug)),
        ...activeEnrollments.map((course) => course.university_courses?.skill_slug).filter((slug): slug is string => Boolean(slug)),
      ]} />

      {visibleCompleted.length > 0 && (
        <section className="space-y-2" aria-label="Recent achievements">
          <h2 className="font-semibold text-lg">Recent achievements</h2>
          {visibleCompleted.slice(0, 3).map((enrollment) => (
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
