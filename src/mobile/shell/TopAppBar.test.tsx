import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopAppBar } from './TopAppBar';
import { useLanguageStore } from '@/hooks/useTranslation';

vi.mock('@/hooks/useUnifiedInbox', () => ({ useUnifiedInboxUnreadCount: () => 2 }));
vi.mock('@/hooks/useGameData', () => ({ useGameData: () => ({ refetch: vi.fn() }) }));
vi.mock('@/hooks/useCharacterSlots', () => ({ useCharacterSlots: () => ({
  characters: [{ id: 'one', display_name: 'Shockmaster', is_active: true, level: 1 }],
  slots: { usedSlots: 1, maxSlots: 2, canCreateNew: true },
  switchCharacter: { mutateAsync: vi.fn() },
}) }));
beforeEach(() => useLanguageStore.getState().setLanguage('en'));
describe('mobile top bar', () => {
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