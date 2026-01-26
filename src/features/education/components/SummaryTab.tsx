import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  BookOpen,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Video,
  Wifi,
  WifiOff,
  TrendingUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useEducationSummary } from "../hooks/useEducationSummary";

export const SummaryTab = () => {
  const {
    currentCityName,
    activeBooks,
    activeEnrollments,
    completedEnrollments,
    yesterdayProgress,
    skillProgress,
    isLoading,
  } = useEducationSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading your education summary...
      </div>
    );
  }

  const hasActiveEducation = activeBooks.length > 0 || activeEnrollments.length > 0;
  const hasYesterdayProgress = yesterdayProgress.totalXp > 0;

  return (
    <div className="space-y-8">
      {/* Yesterday's Progress */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Yesterday's Progress</h2>
        </div>

        {!hasYesterdayProgress ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-4 py-6">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No educational progress yesterday</p>
                <p className="text-sm text-muted-foreground">
                  Keep learning to build your skills every day!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Total XP Summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Total XP Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{yesterdayProgress.totalXp}</p>
                <p className="text-sm text-muted-foreground">from all education activities</p>
              </CardContent>
            </Card>

            {/* University Classes */}
            {yesterdayProgress.universityAttendance.map((attendance) => (
              <Card key={attendance.enrollment_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4" />
                    {attendance.course_name || "University Class"}
                  </CardTitle>
                  <CardDescription>{attendance.university_name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">XP Earned</span>
                    <span className="font-semibold text-primary">+{attendance.xp_earned}</span>
                  </div>
                  {attendance.was_remote && (
                    <Badge variant={attendance.connection_failed ? "destructive" : "secondary"} className="gap-1">
                      {attendance.connection_failed ? (
                        <>
                          <WifiOff className="h-3 w-3" />
                          Connection Failed (Half XP)
                        </>
                      ) : (
                        <>
                          <Video className="h-3 w-3" />
                          Remote via Zoom
                        </>
                      )}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Book Reading */}
            {yesterdayProgress.bookReading.map((reading) => (
              <Card key={reading.session_id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4" />
                    Book Reading
                  </CardTitle>
                  <CardDescription>{reading.book_title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">XP Earned</span>
                    <span className="font-semibold text-primary">+{reading.xp_earned}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Currently Reading */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Books You're Reading</h2>
        </div>

        {activeBooks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-6">
              <div className="flex items-center gap-4">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">No books in progress</p>
                  <p className="text-sm text-muted-foreground">
                    Purchase and start reading skill books to learn passively.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link to="/education?tab=books">Browse Books</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeBooks.map((session) => {
              const progress = session.skill_books
                ? (session.days_read / session.skill_books.base_reading_days) * 100
                : 0;

              return (
                <Card key={session.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{session.skill_books?.title}</CardTitle>
                    <CardDescription>by {session.skill_books?.author}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          Day {session.days_read} / {session.skill_books?.base_reading_days}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{session.skill_books?.skill_slug?.replace(/_/g, " ")}</Badge>
                      <Badge variant="secondary">+{session.total_skill_xp_earned} XP</Badge>
                      {session.auto_read && (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Auto-read
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Currently Enrolled Courses */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Courses You're Studying</h2>
        </div>

        {activeEnrollments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-6">
              <div className="flex items-center gap-4">
                <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">Not enrolled in any courses</p>
                  <p className="text-sm text-muted-foreground">
                    Enroll in university courses to gain skills through structured education.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link to="/education?tab=university">Browse Universities</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeEnrollments.map((enrollment) => {
              const courseDays = enrollment.university_courses?.base_duration_days || 30;
              const progress = (enrollment.days_attended / courseDays) * 100;
              const skill = enrollment.university_courses?.skill_slug || "";
              const skillData = skillProgress[skill];
              const isRemote = currentCityName && enrollment.universities?.city !== currentCityName;

              return (
                <Card key={enrollment.id} className={isRemote ? "border-amber-500/30" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">{enrollment.university_courses?.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {enrollment.universities?.name} • {enrollment.universities?.city}
                        </CardDescription>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/university/${enrollment.university_id}`}>View</Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isRemote && (
                      <Alert className="border-warning/50 bg-warning/10">
                        <Video className="h-4 w-4" />
                        <AlertTitle className="text-sm">Remote Learning Active</AlertTitle>
                        <AlertDescription className="text-xs">
                          You're in {currentCityName} but this university is in {enrollment.universities?.city}.
                          Classes will be attended via Zoom (10% less effective, risk of connection issues).
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Course Progress</span>
                        <span className="font-medium">
                          Day {enrollment.days_attended} / {courseDays}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {skillData && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {skill.replace(/_/g, " ")} Level {skillData.level}
                          </span>
                          <span className="font-medium">
                            {skillData.xp} / {skillData.required} XP
                          </span>
                        </div>
                        <Progress
                          value={(skillData.xp / skillData.required) * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{skill.replace(/_/g, " ")}</Badge>
                      <Badge variant="secondary">+{enrollment.total_xp_earned} XP total</Badge>
                      {enrollment.auto_attend && (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Auto-attend
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Completed Courses */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Completed Courses</h2>
        </div>

        {completedEnrollments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-4 py-6">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No completed courses yet</p>
                <p className="text-sm text-muted-foreground">
                  Finish university courses to build your educational history.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completedEnrollments.map((enrollment) => (
              <Card key={enrollment.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{enrollment.university_courses?.name}</p>
                      <p className="text-xs text-muted-foreground">{enrollment.universities?.name}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {enrollment.university_courses?.skill_slug?.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {enrollment.total_xp_earned} XP
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {enrollment.days_attended} days
                    </Badge>
                  </div>
                  {enrollment.actual_completion_date && (
                    <p className="text-xs text-muted-foreground">
                      Completed {format(parseISO(enrollment.actual_completion_date), "MMM d, yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {!hasActiveEducation && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Start Your Learning Journey</AlertTitle>
          <AlertDescription>
            You don't have any active education. Consider enrolling in a university course or starting to read a skill book
            to grow your abilities consistently over time.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
