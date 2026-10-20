import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecordingProgressScene } from './RecordingProgressScene';
import { TicketSalesDisplay } from '../gig/TicketSalesDisplay';

describe('progression scene presentation', () => {
  it('keeps recording status readable after artwork fails', () => {
    const { container } = render(<RecordingProgressScene status="in_progress" start="2026-10-20T12:00:00Z" end="2026-10-20T13:00:00Z" now={Date.parse('2026-10-20T14:00:00Z')} />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByText('Ready to finalise')).toBeVisible();
    expect(screen.getByText('Finalise').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Complete').closest('li')).not.toHaveAttribute('aria-current');
  });
  it('does not claim sold out for unknown capacity in compact mode', () => {
    render(<TicketSalesDisplay ticketsSold={0} predictedTickets={100} venueCapacity={0} compact />);
    expect(screen.queryByText('SOLD OUT')).toBeNull();
  });
  it('labels the capacity illustration and keeps actual sales visible', () => {
    render(<TicketSalesDisplay ticketsSold={50} predictedTickets={150} venueCapacity={200} />);
    expect(screen.getByText('Sold: 50')).toBeVisible();
    expect(screen.getByText('25% filled')).toBeVisible();
    expect(screen.getByText('Capacity illustration · not a seat map')).toBeVisible();
  });
});
