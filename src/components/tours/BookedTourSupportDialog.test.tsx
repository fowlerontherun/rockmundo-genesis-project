import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BookedTourSupportDialog } from './BookedTourSupportDialog';
import { TourSupportInviteShortcut } from './TourSupportInviteShortcut';
vi.mock('./TourSupportPanel', () => ({ TourSupportPanel: ({ tourId, headlinerBandId, tourStatus, initialSupportBandId }: { tourId: string; headlinerBandId: string; tourStatus: string; initialSupportBandId?: string }) => <div>{`Support ${tourId} ${headlinerBandId} ${tourStatus}${initialSupportBandId ? ` for ${initialSupportBandId}` : ''}`}</div> }));
it('opens support invitations directly for a booked active tour and hides completed tours', async () => {
 const view = render(<BookedTourSupportDialog tourId="tour" bandId="band" tourName="Summer tour" status="active" />);
 fireEvent.click(screen.getByRole('button', { name: 'Invite bands to tour' }));
 expect(await screen.findByText('Support tour band active')).toBeInTheDocument();
 expect(screen.getByText(/remaining dates on this booked tour/)).toBeInTheDocument();
 view.unmount();
 render(<BookedTourSupportDialog tourId="tour" bandId="band" tourName="Past tour" status="completed" />);
 expect(screen.queryByRole('button', { name: 'Invite bands to tour' })).not.toBeInTheDocument();
});

it('opens the exact suggested tour with the linked band and never falls back to another tour', async () => {
 const tours = [
  { id: 'first', name: 'First tour', status: 'active', start_date: '2030-03-01' },
  { id: 'second', name: 'Second tour', status: 'scheduled', start_date: '2030-04-01' },
 ];
 const view = render(<TourSupportInviteShortcut bandId="band" targetBandId="suggested" requestedTourId="second" tours={tours} />);
 fireEvent.click(screen.getByRole('button', { name: 'Invite bands to tour' }));
 expect(await screen.findByText('Support second band scheduled for suggested')).toBeInTheDocument();
 view.unmount();
 render(<TourSupportInviteShortcut bandId="band" targetBandId="suggested" requestedTourId="missing" tours={tours} />);
 expect(screen.getByText(/The linked tour is unavailable/)).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Invite bands to tour' })).not.toBeInTheDocument();
});
