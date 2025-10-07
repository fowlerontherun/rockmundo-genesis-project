import { format, differenceInDays } from "date-fns";
import { Calendar, BookOpen, Award, DollarSign, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AttendanceRecord {
  attendance_date: string;
  xp_earned: number;
  was_locked_out: boolean;
}

interface EnrollmentData {
  id: string;
  status: string;
  days_attended: number;
  total_xp_earned: number;
  scheduled_end_date: string;
  payment_amount: number;
  university_courses: {
    name: string;
    base_duration_days: number;
  };
  universities: {
    name: string;
  };
  player_university_attendance: AttendanceRecord[];
}

interface EnrollmentProgressCardProps {
  enrollment: EnrollmentData;
  onDropCourse?: () => void;
}

export function EnrollmentProgressCard({ enrollment, onDropCourse }: EnrollmentProgressCardProps) {
  const totalDays = enrollment.university_courses.base_duration_days;
  const daysAttended = enrollment.days_attended;
  const progressPercentage = (daysAttended / totalDays) * 100;
  const daysRemaining = differenceInDays(new Date(enrollment.scheduled_end_date), new Date());
  const avgXpPerDay = daysAttended > 0 ? Math.round(enrollment.total_xp_earned / daysAttended) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-500";
      case "enrolled":
        return "bg-green-500";
      case "completed":
        return "bg-purple-500";
      default:
        return "bg-muted";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "enrolled":
        return "Enrolled";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{enrollment.university_courses.name}</CardTitle>
            <CardDescription className="text-base">
              {enrollment.universities.name}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(enrollment.status)}>
            {getStatusLabel(enrollment.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Course Progress</span>
            <span className="text-muted-foreground">
              {daysAttended} / {totalDays} days
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Award className="h-4 w-4" />
              <span className="text-xs font-medium">Total XP Earned</span>
            </div>
            <p className="text-2xl font-bold">{enrollment.total_xp_earned}</p>
            {avgXpPerDay > 0 && (
              <p className="text-xs text-muted-foreground">{avgXpPerDay} XP/day avg</p>
            )}
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Days Remaining</span>
            </div>
            <p className="text-2xl font-bold">{Math.max(0, daysRemaining)}</p>
            <p className="text-xs text-muted-foreground">
              Ends {format(new Date(enrollment.scheduled_end_date), "MMM d, yyyy")}
            </p>
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium">Days Attended</span>
            </div>
            <p className="text-2xl font-bold">{daysAttended}</p>
            <p className="text-xs text-muted-foreground">
              {Math.round(progressPercentage)}% complete
            </p>
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Amount Paid</span>
            </div>
            <p className="text-2xl font-bold">${enrollment.payment_amount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Course fee</p>
          </div>
        </div>

        {/* Attendance History */}
        {enrollment.player_university_attendance.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4" />
              Recent Attendance
            </h4>
            <div className="space-y-2">
              {enrollment.player_university_attendance
                .slice(-5)
                .reverse()
                .map((record, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          record.was_locked_out
                            ? "bg-destructive/20 text-destructive"
                            : "bg-primary/20 text-primary"
                        }`}
                      >
                        {record.was_locked_out ? "✗" : "✓"}
                      </div>
                      <div>
                        <p className="font-medium">
                          {format(new Date(record.attendance_date), "EEEE, MMM d")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.was_locked_out ? "Missed class" : "Attended"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">+{record.xp_earned} XP</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Class Reminder */}
        {enrollment.status === "in_progress" && daysRemaining > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              📚 Remember to attend class between 10:00 AM - 2:00 PM to earn daily XP!
            </p>
          </div>
        )}

        {/* Actions */}
        {onDropCourse && enrollment.status !== "completed" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Drop Course
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dropping this course will forfeit your enrollment fee of $
                  {enrollment.payment_amount.toLocaleString()} and lose all progress. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDropCourse}>Drop Course</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
