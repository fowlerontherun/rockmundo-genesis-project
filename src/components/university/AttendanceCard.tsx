import { format } from "date-fns";
import { CalendarCheck, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AttendanceCardProps {
  canAttendClass: boolean;
  isAttending: boolean;
  activityStatus: any;
  autoAttendEnabled: boolean;
  todayAttendance: any;
  onAttendClass: () => void;
  onToggleAutoAttend: () => void;
  isTogglingAuto: boolean;
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
}: AttendanceCardProps) {
  const now = new Date();
  const currentHour = now.getHours();
  const isClassTime = currentHour >= 10 && currentHour < 14;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Daily Attendance
        </CardTitle>
        <CardDescription>
          Attend class between 10 AM - 2 PM daily to earn XP and improve your skills
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

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-attend" className="text-base font-medium">
              Auto-attend classes
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically attend at 10 AM daily when enrolled
            </p>
          </div>
          <Switch
            id="auto-attend"
            checked={autoAttendEnabled}
            onCheckedChange={onToggleAutoAttend}
            disabled={isTogglingAuto}
          />
        </div>

        {!isClassTime && !todayAttendance && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Classes are held from 10 AM to 2 PM. {autoAttendEnabled ? "Auto-attendance is enabled." : "Come back during class time or enable auto-attend."}
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
            ? "Not Class Time (10 AM - 2 PM)"
            : "Attend Class"}
        </Button>

        {autoAttendEnabled && (
          <div className="rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Auto</Badge>
              Daily attendance will be automatically recorded at 10 AM
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
