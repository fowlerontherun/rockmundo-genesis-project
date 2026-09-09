import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PlayerModelEditor from './PlayerModelEditor';
import { defaultAppearance, SLOTS, SLOT_LABELS, STARTER_ITEMS } from './appearance';
import { usePlayerModel } from './usePlayerModel';

vi.mock('./usePlayerModel', () => ({ usePlayerModel: vi.fn() }));
vi.mock('./PlayerModelPreview', () => ({ PlayerModelPreview: () => <div>Model preview</div> }));
const save = vi.fn();
function model(profileId = 'character-one') {
  return { profileId, profile: null, userId: 'owner', isLoading: false, error: null,
    query: { data: { appearance: defaultAppearance(profileId), revision: null }, isPending: false, isError: false, isFetching: false, refetch: vi.fn() },
    save: { isPending: false, mutateAsync: save },
  } as unknown as ReturnType<typeof usePlayerModel>;
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(usePlayerModel).mockReturnValue(model()); save.mockImplementation(async args => ({ appearance: args.appearance, revision: 1 })); });
afterEach(cleanup);
it('previews edits without saving, then persists the selected character and equipped pieces', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Feminine' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tailored jacket' }));
  fireEvent.change(screen.getByLabelText('Try a performance pose'), { target: { value: 'guitar' } });
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'character-one', revision: null, appearance: expect.objectContaining({ body: expect.objectContaining({ frame: 'feminine' }), equipment: expect.objectContaining({ top: expect.objectContaining({ itemId: 'starter.top.suit' }) }) }) })));
  expect(await screen.findByText(/Avatar saved\./)).toBeVisible();
});
it('preserves edits after a failed save and resets the draft when the active character changes', async () => {
  save.mockRejectedValueOnce(new Error('This model changed in another window. Reload the saved model before saving again.'));
  const view = render(<PlayerModelEditor />); fireEvent.click(screen.getByRole('button', { name: 'Feminine' })); fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('another window'); expect(screen.getByRole('button', { name: 'Feminine' })).toHaveAttribute('aria-pressed', 'true');
  vi.mocked(usePlayerModel).mockReturnValue(model('character-two')); view.rerender(<PlayerModelEditor />);
  expect(screen.getByRole('button', { name: 'Masculine' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ profileId: 'character-two' })));
});

it('gives every character six free choices per clothing type and persists new designs and colours', async () => {
  render(<PlayerModelEditor />);
  for (const slot of SLOTS) {
    const group = screen.getByRole('group', { name: SLOT_LABELS[slot] });
    for (const item of STARTER_ITEMS[slot]) expect(within(group).getByRole('button', { name: item.label })).toBeEnabled();
    fireEvent.click(within(group).getByRole('button', { name: STARTER_ITEMS[slot][5].label }));
    fireEvent.click(within(group).getByRole('button', { name: `${SLOT_LABELS[slot]} colour: Teal` }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  for (const slot of SLOTS) expect(save.mock.calls[0][0].appearance.equipment[slot]).toEqual({ itemId: STARTER_ITEMS[slot][5].id, color: '#338b8d' });
});
