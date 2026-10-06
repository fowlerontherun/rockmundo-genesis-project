import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterSwitcher } from './CharacterSwitcher';
import { useLanguageStore } from '@/hooks/useTranslation';

const mocks = vi.hoisted(() => ({ switch: vi.fn(), refetch: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/useCharacterSlots', () => ({ useCharacterSlots: () => ({
  slots: { usedSlots: 2, maxSlots: 2, canCreateNew: false },
  characters: [
    { id: 'one', display_name: 'Shockmaster', is_active: true, level: 10, fame: 100, generation_number: 1 },
    { id: 'two', display_name: 'Wardog', is_active: false, level: 2, fame: 5, generation_number: 1 },
  ],
  switchCharacter: { mutateAsync: mocks.switch },
}) }));
vi.mock('@/hooks/useGameData', () => ({ useGameData: () => ({ refetch: mocks.refetch }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
const mount = (mobile = true) => render(<MemoryRouter initialEntries={['/mobile/inbox']}><CharacterSwitcher mobile={mobile} /><Location /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  useLanguageStore.getState().setLanguage('en');
  mocks.switch.mockResolvedValue(undefined);
  mocks.refetch.mockResolvedValue(undefined);
});
describe('character menu', () => {
  it('switches from mobile and refreshes data before returning to the mobile schedule', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Switch character' }));
    expect(screen.getByRole('menuitem', { name: /Shockmaster/ })).toHaveAttribute('data-disabled');
    await user.click(screen.getByRole('menuitem', { name: /Wardog/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/mobile'));
    expect(mocks.switch).toHaveBeenCalledWith('two');
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(mocks.switch.mock.invocationCallOrder[0]).toBeLessThan(mocks.refetch.mock.invocationCallOrder[0]);
  });
  it('keeps desktop switching on the desktop home page', async () => {
    const user = userEvent.setup(); mount(false);
    await user.click(screen.getByRole('button', { name: 'Switch character' }));
    await user.click(screen.getByRole('menuitem', { name: /Wardog/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/home'));
  });
  it('blocks more selections while the switch is pending', async () => {
    let complete: (() => void) | undefined;
    mocks.switch.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Switch character' }));
    await user.click(screen.getByRole('menuitem', { name: /Wardog/ }));
    expect(screen.getByRole('button', { name: 'Switching character…' })).toBeDisabled();
    expect(mocks.switch).toHaveBeenCalledOnce();
    complete?.();
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce());
  });
  it('shows failure without navigating or refreshing and allows retry', async () => {
    mocks.switch.mockRejectedValueOnce(new Error('Unavailable'));
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Switch character' }));
    await user.click(screen.getByRole('menuitem', { name: /Wardog/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByTestId('location')).toHaveTextContent('/mobile/inbox');
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Switch character' })).toBeEnabled();
  });
  it('translates the character trigger and menu when language changes', async () => {
    useLanguageStore.getState().setLanguage('fr');
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Changer de personnage' }));
    expect(screen.getByText('emplacements', { exact: false })).toBeInTheDocument();
  });
});