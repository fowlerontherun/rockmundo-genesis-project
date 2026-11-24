import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Users, Route, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTourSupportAssignments } from '@/features/support-bands/tourManagementApi';
import { summarizeSupportCoverage } from '@/lib/tourReadiness';

export function TourReadinessPanel({ tourId, bandId, venueCount, venuesVerified, onDates, onSupport, onOperations }: {
  tourId: string;
  bandId: string;
  venueCount: number;
  venuesVerified: boolean;
  onDates: () => void;
  onSupport: () => void;
  onOperations: () => void;
}) {
  const support = useQuery({
    queryKey: ['tour-support-assignments', tourId, bandId],
    queryFn: () => getTourSupportAssignments({ tourId, headlinerBandId: bandId }),
    enabled: !!tourId && !!bandId,
  });
  const coverage = support.data ? summarizeSupportCoverage(support.data, Date.now()) : null;

  return <Card className="border-primary/20">
    <CardHeader className="pb-2"><CardTitle className="text-base">Tour readiness</CardTitle></CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" />Dates & venues</div>
        <p className="text-sm text-muted-foreground">{venuesVerified ? `${venueCount} booked tour stops` : 'Venue details need checking'}</p>
        <Button size="sm" variant="outline" onClick={onDates}><CalendarDays className="mr-2 h-4 w-4" />View itinerary</Button>
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Support lineup</div>
        {support.isPending ? <p className="text-sm text-muted-foreground">Checking coverage…</p>
          : support.isError ? <p role="alert" className="flex items-center gap-1 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Coverage unavailable</p>
            : <p className="text-sm text-muted-foreground">{coverage?.confirmed ?? 0} confirmed · {coverage?.pending ?? 0} awaiting reply · {coverage?.open ?? 0} open future dates</p>}
        <Button size="sm" variant="outline" onClick={onSupport}>Manage support</Button>
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Route className="h-4 w-4" />Travel & crew</div>
        <p className="text-sm text-muted-foreground">Review members' travel and readiness before the next show.</p>
        <Button size="sm" variant="outline" onClick={onOperations}>Review operations</Button>
      </div>
    </CardContent>
  </Card>;
}
