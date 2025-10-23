import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Sparkles } from "lucide-react";

interface RehearsalWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle: string;
  rehearsalStage: 'unrehearsed' | 'tight' | 'perfect';
  familiarityMinutes: number;
  qualityPenalty: number;
  onConfirm: () => void;
}

const STAGE_CONFIG = {
  unrehearsed: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    title: '⚠️ Unrehearsed Song Warning',
    description: 'This song has minimal rehearsal time. Recording quality will be significantly reduced.',
  },
  tight: {
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    title: '⚡ Adequately Rehearsed',
    description: 'This song has been rehearsed enough for standard recording quality.',
  },
  perfect: {
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    title: '✨ Perfectly Rehearsed!',
    description: 'This song is perfectly rehearsed! Recording quality will receive a bonus.',
  },
};

export function RehearsalWarningDialog({
  open,
  onOpenChange,
  songTitle,
  rehearsalStage,
  familiarityMinutes,
  qualityPenalty,
  onConfirm,
}: RehearsalWarningDialogProps) {
  const config = STAGE_CONFIG[rehearsalStage];
  const Icon = config.icon;
  const shouldWarn = rehearsalStage === 'unrehearsed';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            {config.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className={`p-4 rounded-lg ${config.bgColor}`}>
              <p className="font-medium mb-2">Song: {songTitle}</p>
              <p className="text-sm">{config.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-muted-foreground mb-1">Rehearsal Time</p>
                <p className="font-bold">{familiarityMinutes} minutes</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-muted-foreground mb-1">Quality Impact</p>
                <p className={`font-bold ${qualityPenalty < 0 ? 'text-destructive' : qualityPenalty > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {qualityPenalty > 0 ? '+' : ''}{qualityPenalty}%
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Rehearsal Stages:</p>
              <ul className="space-y-1 ml-4">
                <li className={rehearsalStage === 'unrehearsed' ? 'font-bold text-destructive' : 'text-muted-foreground'}>
                  • 0-20 min: <Badge variant="destructive">Unrehearsed</Badge> -20% quality
                </li>
                <li className={rehearsalStage === 'tight' ? 'font-bold text-yellow-600' : 'text-muted-foreground'}>
                  • 21-40 min: <Badge variant="outline">Tight</Badge> No penalty
                </li>
                <li className={rehearsalStage === 'perfect' ? 'font-bold text-primary' : 'text-muted-foreground'}>
                  • 41-60 min: <Badge variant="default">Perfect</Badge> +10% quality
                </li>
              </ul>
            </div>

            {shouldWarn && (
              <p className="text-xs text-muted-foreground">
                💡 Tip: Book a rehearsal session first to improve recording quality!
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {shouldWarn ? 'Record Anyway' : 'Continue Recording'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
