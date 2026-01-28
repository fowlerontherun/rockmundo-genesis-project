import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar } from "lucide-react";
import { format } from "date-fns";

interface ConflictingActivity {
  id: string;
  activity_type: string;
  scheduled_start: string;
  scheduled_end: string;
  title?: string;
  description?: string;
}

interface FestivalScheduleConflictWarningProps {
  hasConflict: boolean;
  conflictingActivities: ConflictingActivity[];
  isChecking?: boolean;
}

export function FestivalScheduleConflictWarning({
  hasConflict,
  conflictingActivities,
  isChecking,
}: FestivalScheduleConflictWarningProps) {
  if (isChecking) {
    return (
      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertTitle>Checking schedule...</AlertTitle>
        <AlertDescription>
          Verifying availability for these dates.
        </AlertDescription>
      </Alert>
    );
  }

  if (!hasConflict) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Schedule Conflict Detected</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>You have existing commitments during this festival:</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {conflictingActivities.map((activity) => (
            <Badge key={activity.id} variant="outline" className="text-destructive border-destructive">
              {activity.title || activity.description || activity.activity_type}
              {activity.scheduled_start && (
                <span className="ml-1 text-xs opacity-75">
                  ({format(new Date(activity.scheduled_start), "MMM d")})
                </span>
              )}
            </Badge>
          ))}
        </div>
        <p className="text-xs mt-2">
          Cancel conflicting activities before applying to this festival.
        </p>
      </AlertDescription>
    </Alert>
  );
}
