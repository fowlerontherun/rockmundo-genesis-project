import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { InboxMessage as InboxMessageType } from '@/hooks/useInbox';
import { InboxMessage } from './InboxMessage';

vi.mock('@/hooks/useCollaborationInvites', () => ({ useCollaborationInvites: () => ({ respondToInvitation: {} }) }));
vi.mock('@/hooks/useGigAbsenceDecision', () => ({ useGigAbsenceDecision: () => ({}) }));
afterEach(cleanup);

const proposalId = 'e920da1d-7f34-449f-9ab6-b8cd015986cd';
const route = '/gig-booking?tab=play-together&section=offers&bandId=recipient';
const proposalMessage: InboxMessageType = {
  id: 'notification',
  user_id: 'player',
  category: 'social',
  priority: 'normal',
  title: 'Tour proposal: pending',
  message: 'Review the itinerary.',
  metadata: { event_key: `support_tour_proposals:${proposalId}:pending:2026-11-09T17:10:00Z` },
  action_type: 'navigate',
  action_data: { route },
  related_entity_type: 'band',
  related_entity_id: 'recipient',
  is_read: false,
  is_archived: false,
  expires_at: null,
  created_at: '2026-11-09T17:10:00Z',
};

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output aria-label="Current route">{pathname}{search}</output>;
}

function show(message: InboxMessageType) {
  const markAsRead = vi.fn();
  render(
    <MemoryRouter>
      <InboxMessage message={message} onMarkAsRead={markAsRead} onArchive={vi.fn()} onDelete={vi.fn()} />
      <LocationProbe />
    </MemoryRouter>,
  );
  return markAsRead;
}

it('opens the proposal from existing inbox metadata and preserves the recipient band', () => {
  const markAsRead = show(proposalMessage);
  fireEvent.click(screen.getByRole('button', { name: 'Review tour proposal' }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(`${route}&proposalId=${proposalId}`);
  expect(markAsRead).toHaveBeenCalledWith('notification');
});

it.each([
  { metadata: { event_key: 'support_tour_proposals:invalid:pending' }, action_data: { route } },
  { metadata: proposalMessage.metadata, action_data: { route: '/gigs' } },
])('keeps the regular navigation action for an unrecognized proposal notification', overrides => {
  show({ ...proposalMessage, ...overrides });
  fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(overrides.action_data.route);
  expect(screen.getByLabelText('Current route')).not.toHaveTextContent('proposalId');
});
