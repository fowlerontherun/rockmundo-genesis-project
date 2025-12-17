import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface MusicOwnershipReminderProps {
  compact?: boolean;
}

export const MusicOwnershipReminder = ({ compact = false }: MusicOwnershipReminderProps) => {
  if (compact) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
        <span>All songs are owned by Rockmundo and cannot be uploaded externally.</span>
      </p>
    );
  }

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-xs">
        <span className="font-semibold">Important:</span> All songs created in Rockmundo, including AI-generated music, 
        are the intellectual property of Rockmundo. Songs cannot be uploaded to Spotify, Apple Music, 
        YouTube, or any external platform.
      </AlertDescription>
    </Alert>
  );
};
