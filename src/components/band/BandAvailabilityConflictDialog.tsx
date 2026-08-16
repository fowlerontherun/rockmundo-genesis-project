import { AlertTriangle, CalendarClock, UserX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  describeActivityType,
  formatConflictWindow,
  type ConflictInfo,
} from "@/utils/bandActivityScheduling";

interface BandAvailabilityConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityLabel: string;
  conflicts: ConflictInfo[];
  currentProfileId?: string | null;
  canOverride?: boolean;
  isSubmitting?: boolean;
  onProceedWithout: (skipProfileIds: string[]) => void;
}

export function BandAvailabilityConflictDialog({
  open,
  onOpenChange,
  activityLabel,
  conflicts,
  currentProfileId,
  canOverride = false,
  isSubmitting = false,
  onProceedWithout,
}: BandAvailabilityConflictDialogProps) {
  const skipIds = conflicts
    .map((c) => c.profileId)
    .filter((id): id is string => Boolean(id));
  const includesYou = conflicts.some(
    (c) => currentProfileId && c.profileId === currentProfileId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Band members unavailable
          </DialogTitle>
          <DialogDescription className="text-xs">
            These members already have something booked that clashes with{" "}
            {activityLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {conflicts.map((conflict, index) => {
            const isYou = currentProfileId && conflict.profileId === currentProfileId;
            const when = formatConflictWindow(conflict);
            return (
              <div
                key={`${conflict.profileId ?? conflict.userId}-${index}`}
                className="rounded-md border bg-muted/30 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {isYou ? "You" : conflict.userName || "Band member"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {describeActivityType(conflict.activityType)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conflict.activityTitle}
                </p>
                {when && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    {when}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {includesYou && (
          <p className="text-xs text-destructive">
            You are one of the clashing members — cancel your other activity or
            pick a different time.
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Pick another time
          </Button>
          {canOverride && !includesYou && (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              disabled={isSubmitting || skipIds.length === 0}
              onClick={() => onProceedWithout(skipIds)}
            >
              <UserX className="mr-2 h-4 w-4" />
              Book without {skipIds.length === 1 ? "them" : `${skipIds.length} members`}
            </Button>
          )}
        </DialogFooter>
        {canOverride && !includesYou && (
          <p className="text-[11px] text-muted-foreground">
            Absent members are notified and can still join if they clear their
            schedule.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
