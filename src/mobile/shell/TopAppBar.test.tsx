import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopAppBar } from './TopAppBar';
import { useLanguageStore } from '@/hooks/useTranslation';

const mobileAuth = vi.hoisted(() => ({ signOut: vi.fn(async () => {}) }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuth: () => ({ signOut: mobileAuth.signOut }) }));
// The header only uses the resurrection mutation when switching a comatose character.
 // Keep the header test independent of the unrelated character-death query client.
vi.mock('@/hooks/useCharacterDeath', () => ({
  useCharacterDeath: () => ({ resurrectCharacter: { mutateAsync: vi.fn() } }),
}));
vi.mock('@/hooks/useUnifiedInbox', () => ({ useUnifiedInboxUnreadCount: () => 2 }));
vi.mock('@/hooks/useGameData', () => ({ useGameData: () => ({ refetch: vi.fn() }) }));
vi.mock('@/hooks/useCharacterSlots', () => ({ useCharacterSlots: () => ({
  characters: [{ id: 'one', display_name: 'Shockmaster', is_active: true, level: 1 }],
  slots: { usedSlots: 1, maxSlots: 2, canCreateNew: true },
  switchCharacter: { mutateAsync: vi.fn() },
}) }));
beforeEach(() => useLanguageStore.getState().setLanguage('en'));
const LocationView = () => <span data-testid="mobile-path">{useLocation().pathname}</span>;
describe('mobile top bar', () => {
  it('provides a visible mobile sign-out action and returns to auth', async () => {
    const user = userEvent.setup();
    mobileAuth.signOut.mockClear();
    render(<MemoryRouter initialEntries={['/mobile/education']}><TopAppBar /><LocationView /></MemoryRouter>);
    expect(screen.getByText('Education')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(mobileAuth.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('mobile-path')).toHaveTextContent('/auth');
  });
  it('provides a character menu even for a single character', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/mobile']}><TopAppBar /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Switch character' }));
    expect(screen.getByRole('menuitem', { name: /Shockmaster/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New Character' })).toBeInTheDocument();
  });
  it('updates mobile titles and controls immediately when selecting another language', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/mobile?view=book']}><TopAppBar /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Select Language' }));
    await user.click(screen.getByRole('menuitem', { name: /Français/ }));
    expect(screen.getByText('Réserver une activité')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Changer de personnage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 non lus/ })).toBeInTheDocument();
    expect(useLanguageStore.getState().language).toBe('fr');
  });
});