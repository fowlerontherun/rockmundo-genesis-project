import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Sparkles } from "lucide-react";

interface RehearsalWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle: string;
  rehearsalStage: string;
  familiarityMinutes: number;
  qualityPenalty: number;
  onConfirm: () => void;
}

const STAGE_CONFIG = {
  // Low rehearsal stages (penalty)
  unrehearsed: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    title: '⚠️ Unrehearsed Song Warning',
    description: 'This song has minimal rehearsal time. Recording quality will be significantly reduced.',
  },
  unlearned: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    title: '⚠️ Unlearned Song Warning',
    description: 'This song has minimal rehearsal time. Recording quality will be significantly reduced.',
  },
  learning: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    title: '📚 Still Learning',
    description: 'This song is still being learned. Recording quality may suffer.',
  },
  // Medium rehearsal stages (neutral)
  tight: {
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    title: '⚡ Adequately Rehearsed',
    description: 'This song has been rehearsed enough for standard recording quality.',
  },
  familiar: {
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    title: '⚡ Familiar',
    description: 'This song is familiar to the band. Standard recording quality expected.',
  },
  well_rehearsed: {
    icon: Zap,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    title: '✓ Well Rehearsed',
    description: 'This song is well rehearsed. Good recording quality expected.',
  },
  // High rehearsal stages (bonus)
  perfect: {
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    title: '✨ Perfectly Rehearsed!',
    description: 'This song is perfectly rehearsed! Recording quality will receive a bonus.',
  },
  perfected: {
    icon: Sparkles,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    title: '✨ Perfected!',
    description: 'This song is perfected! Recording quality will receive a bonus.',
  },
};

// Default config for unknown stages
const DEFAULT_CONFIG = {
  icon: AlertTriangle,
  color: 'text-muted-foreground',
  bgColor: 'bg-muted/10',
  title: 'Rehearsal Status',
  description: 'Check your rehearsal progress before recording.',
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
  const config = STAGE_CONFIG[rehearsalStage as keyof typeof STAGE_CONFIG] || DEFAULT_CONFIG;
  const Icon = config.icon;
  const shouldWarn = ['unrehearsed', 'unlearned', 'learning'].includes(rehearsalStage);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            {config.title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className={`p-4 rounded-lg ${config.bgColor}`}>
                <span className="font-medium block mb-2">Song: {songTitle}</span>
                <span className="text-sm">{config.description}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg border bg-card">
                  <span className="text-muted-foreground block mb-1">Rehearsal Time</span>
                  <span className="font-bold block">{familiarityMinutes} minutes</span>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <span className="text-muted-foreground block mb-1">Quality Impact</span>
                  <span className={`font-bold block ${qualityPenalty < 0 ? 'text-destructive' : qualityPenalty > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {qualityPenalty > 0 ? '+' : ''}{qualityPenalty}%
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <span className="font-medium block">Rehearsal Stages:</span>
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
                <span className="text-xs text-muted-foreground block">
                  💡 Tip: Book a rehearsal session first to improve recording quality!
                </span>
              )}
            </div>
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
