import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users } from 'lucide-react';
import { TourSupportPanel } from './TourSupportPanel';

/** Entry point for adding support after saved tour gigs have been booked. */
export function BookedTourSupportDialog({ tourId, bandId, tourName, status }: {
  tourId: string; bandId: string; tourName: string; status: string;
}) {
  if (status !== 'scheduled' && status !== 'active') return null;
  return <Dialog>
    <DialogTrigger asChild><Button variant="secondary" size="sm" className="w-full"><Users className="mr-2 h-4 w-4" />Invite bands to tour</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Invite bands · {tourName}</DialogTitle>
        <DialogDescription>Invite support bands to the remaining dates on this booked tour. Select a band and the dates to offer; the band must accept before joining.</DialogDescription>
      </DialogHeader>
      <TourSupportPanel key={tourId} tourId={tourId} headlinerBandId={bandId} tourStatus={status} />
    </DialogContent>
  </Dialog>;
}
