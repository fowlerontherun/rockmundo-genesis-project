import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Ban, Calendar, Info } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface BandStatusBannerProps {
  status: string;
  hiatusStartedAt?: string | null;
  hiatusEndsAt?: string | null;
  hiatusReason?: string | null;
  isLeader: boolean;
  onReactivate?: () => void;
}

export function BandStatusBanner({
  status,
  hiatusStartedAt,
  hiatusEndsAt,
  hiatusReason,
  isLeader,
  onReactivate
}: BandStatusBannerProps) {
  if (status !== 'on_hiatus') return null;

  const startDate = hiatusStartedAt ? new Date(hiatusStartedAt) : null;
  const endDate = hiatusEndsAt ? new Date(hiatusEndsAt) : null;

  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <Ban className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-500">Band on Hiatus</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="text-sm">
          {hiatusReason && (
            <p className="mb-2">
              <strong>Reason:</strong> {hiatusReason}
            </p>
          )}
          
          {startDate && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Started {formatDistanceToNow(startDate, { addSuffix: true })} on {format(startDate, 'MMM d, yyyy')}
            </p>
          )}
          
          {endDate ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Scheduled to end on {format(endDate, 'MMM d, yyyy')} ({formatDistanceToNow(endDate, { addSuffix: true })})
            </p>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Info className="h-3 w-3" />
              Indefinite hiatus - no end date set
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-background/50 p-3">
          <p className="text-sm font-medium">While on hiatus:</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>Cannot perform gigs or jam sessions</li>
            <li>Touring members have been removed</li>
            <li>Chemistry decays slowly (50% normal rate)</li>
            <li>Members can join other bands</li>
          </ul>
        </div>

        {isLeader && onReactivate && (
          <Button 
            onClick={onReactivate} 
            size="sm"
            className="w-full sm:w-auto"
          >
            Reactivate Band
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
