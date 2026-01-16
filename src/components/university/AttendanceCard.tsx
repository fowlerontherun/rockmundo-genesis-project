import { format } from "date-fns";
import { CalendarCheck, CheckCircle, Clock, TrendingUp, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface AttendanceCardProps {
  canAttendClass: boolean;
  isAttending: boolean;
  activityStatus: any;
  autoAttendEnabled: boolean;
  todayAttendance: any;
  onAttendClass: () => void;
  onToggleAutoAttend: () => void;
  isTogglingAuto: boolean;
  classWindow: {
    start: number;
    end: number;
  };
}

export function AttendanceCard({
  canAttendClass,
  isAttending,
  activityStatus,
  autoAttendEnabled,
  todayAttendance,
  onAttendClass,
  onToggleAutoAttend,
  isTogglingAuto,
  classWindow,
}: AttendanceCardProps) {
  const startHour = Math.min(Math.max(Math.floor(classWindow.start), 0), 23);
  const endHour = Math.min(Math.max(Math.floor(classWindow.end), startHour + 1), 24);
  const now = new Date();
  const currentHour = now.getHours();
  const isClassTime = currentHour >= startHour && currentHour < endHour;
  const classWindowLabel = `${format(new Date().setHours(startHour, 0, 0, 0), "h a")} - ${format(
    new Date().setHours(endHour, 0, 0, 0),
    "h a",
  )}`;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Daily Attendance
        </CardTitle>
        <CardDescription>
          Attend class between {classWindowLabel} daily to earn XP and improve your skills
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activityStatus && (
          <Alert className="border-primary/50 bg-primary/10">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Currently in class. Class ends at {format(new Date(activityStatus.ends_at), 'h:mm a')}
            </AlertDescription>
          </Alert>
        )}

        {todayAttendance && !activityStatus && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              ✓ Attended today! Earned {todayAttendance.xp_earned} XP
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced auto-attend toggle with clear visual state */}
        <div className={cn(
          "flex items-center justify-between rounded-lg border p-4 transition-colors",
          autoAttendEnabled 
            ? "bg-green-500/10 border-green-500/30" 
            : "bg-red-500/10 border-red-500/30"
        )}>
          <div className="space-y-0.5">
            <Label htmlFor="auto-attend" className="text-base font-medium flex items-center gap-2">
              {autoAttendEnabled ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              Auto-attend classes
            </Label>
            <p className="text-sm text-muted-foreground">
              {autoAttendEnabled 
                ? "Automatically attending class each day" 
                : "Manual attendance required"}
            </p>
          </div>
          <Switch
            id="auto-attend"
            checked={autoAttendEnabled}
            onCheckedChange={onToggleAutoAttend}
            disabled={isTogglingAuto}
            className={cn(
              autoAttendEnabled && "data-[state=checked]:bg-green-500"
            )}
          />
        </div>

        {!isClassTime && !todayAttendance && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Classes are held from {classWindowLabel}. {autoAttendEnabled
                ? "Auto-attendance is enabled."
                : "Come back during class time or enable auto-attend."}
            </AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          onClick={onAttendClass}
          disabled={!canAttendClass || isAttending || !!activityStatus}
          size="lg"
        >
          {activityStatus
            ? "Currently in Class"
            : isAttending
            ? "Marking Attendance..."
            : todayAttendance
            ? "Already Attended Today"
            : !isClassTime
            ? `Not Class Time (${classWindowLabel})`
            : "Attend Class"}
        </Button>

        {autoAttendEnabled && (
          <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700 dark:text-green-300">Auto</Badge>
              Daily attendance will be automatically recorded at 10 AM
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
