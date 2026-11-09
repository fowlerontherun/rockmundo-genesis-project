import { useState } from 'react';
import { BookedTourSupportDialog } from './BookedTourSupportDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type InviteTour = {
  id: string;
  name: string;
  status: string;
  start_date: string;
};

export function TourSupportInviteShortcut({ bandId, targetBandId, requestedTourId, tours }: {
  bandId: string;
  targetBandId: string;
  requestedTourId?: string;
  tours: InviteTour[];
}) {
  const [selectedId, setSelectedId] = useState('');
  const eligibleTours = tours.filter(tour => tour.status === 'active' || tour.status === 'scheduled');
  const tourId = requestedTourId ?? (selectedId || (eligibleTours.length === 1 ? eligibleTours[0].id : ''));
  const tour = eligibleTours.find(item => item.id === tourId);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Invite a band to your tour</CardTitle>
        <CardDescription>Choose a booked tour to check which dates are available for the band from your link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requestedTourId && !tour && (
          <p role="status" className="text-sm">The linked tour is unavailable for this band. Choose the band that booked it, or start a new invitation from another tour.</p>
        )}
        {!requestedTourId && !eligibleTours.length && (
          <p role="status" className="text-sm">This band has no scheduled or active tours. Book a tour first to invite support.</p>
        )}
        {!requestedTourId && eligibleTours.length > 1 && (
          <label className="block space-y-1 text-sm font-medium">
            <span>Booked tour</span>
            <select className="block w-full rounded-md border bg-background p-2 sm:max-w-md" value={tourId} onChange={event => setSelectedId(event.target.value)}>
              <option value="">Choose a tour</option>
              {eligibleTours.map(item => <option key={item.id} value={item.id}>{item.name} · {item.start_date}</option>)}
            </select>
          </label>
        )}
        {tour && (
          <div className="max-w-md space-y-2">
            <p className="break-words text-sm font-medium">{tour.name}</p>
            <BookedTourSupportDialog key={tour.id} tourId={tour.id} bandId={bandId} tourName={tour.name} status={tour.status} initialSupportBandId={targetBandId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
