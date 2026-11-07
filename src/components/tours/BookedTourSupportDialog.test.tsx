import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BookedTourSupportDialog } from './BookedTourSupportDialog';
vi.mock('./TourSupportPanel', () => ({ TourSupportPanel: ({ tourId, headlinerBandId, tourStatus }: { tourId: string; headlinerBandId: string; tourStatus: string }) => <div>{`Support ${tourId} ${headlinerBandId} ${tourStatus}`}</div> }));
it('opens support invitations directly for a booked active tour and hides completed tours', async () => {
 const view = render(<BookedTourSupportDialog tourId="tour" bandId="band" tourName="Summer tour" status="active" />);
 fireEvent.click(screen.getByRole('button', { name: 'Invite bands to tour' }));
 expect(await screen.findByText('Support tour band active')).toBeInTheDocument();
 expect(screen.getByText(/remaining dates on this booked tour/)).toBeInTheDocument();
 view.unmount();
 render(<BookedTourSupportDialog tourId="tour" bandId="band" tourName="Past tour" status="completed" />);
 expect(screen.queryByRole('button', { name: 'Invite bands to tour' })).not.toBeInTheDocument();
});
