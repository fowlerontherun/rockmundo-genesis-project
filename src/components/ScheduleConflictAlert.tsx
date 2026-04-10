import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ConflictCheckResult, SuggestedSlot } from "@/hooks/useScheduleConflictCheck";

interface ScheduleConflictAlertProps {
  result: ConflictCheckResult;
  onPickSlot: (slot: SuggestedSlot) => void;
  onDismiss?: () => void;
}

export function ScheduleConflictAlert({ result, onPickSlot, onDismiss }: ScheduleConflictAlertProps) {
  if (!result.hasConflict) return null;

  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Schedule Conflict</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="text-sm">
          This time overlaps with:
          <ul className="mt-1 space-y-1">
            {result.conflicts.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="font-medium">{c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.scheduled_start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  –
                  {new Date(c.scheduled_end).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {result.suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Available slots:</p>
            <div className="flex flex-wrap gap-2">
              {result.suggestions.map((slot, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs border-primary/30 hover:bg-primary/10"
                  onClick={() => onPickSlot(slot)}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  {slot.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs mt-1">
            Dismiss
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
