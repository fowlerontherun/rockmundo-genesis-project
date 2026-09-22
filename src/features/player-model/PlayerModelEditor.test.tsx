vi.mock('./OwnedAccessories', () => ({ OwnedAccessories: () => <div>Your collection</div> }));
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PlayerModelEditor from './PlayerModelEditor';
import { defaultAppearance, SLOTS, SLOT_LABELS, STARTER_ITEMS } from './appearance';
import { useEquippedRichClothing, usePlayerModel, usePlayerStageTattoos } from './usePlayerModel';

vi.mock('./usePlayerModel', () => ({ usePlayerModel: vi.fn(), useEquippedRichClothing: vi.fn(), usePlayerStageTattoos: vi.fn() }));
const preview = vi.fn();
vi.mock('./PlayerModelPreview', () => ({ PlayerModelPreview: (props: unknown) => { preview(props); return <div>Model preview</div>; } }));
const save = vi.fn();
function model(profileId = 'character-one') {
  return { profileId, profile: null, userId: 'owner', isLoading: false, error: null,
    query: { data: { appearance: defaultAppearance(profileId), revision: null }, isPending: false, isError: false, isFetching: false, refetch: vi.fn() },
    save: { isPending: false, mutateAsync: save },
  } as unknown as ReturnType<typeof usePlayerModel>;
}
function clothing(data: unknown[] = [], isError = false) {
  return { data, isError, isPending: false, isFetching: false } as unknown as ReturnType<typeof useEquippedRichClothing>;
}
function tattooQuery(data: unknown[] = [], isError = false) {
  return { data, isError, isPending: false, isFetching: false } as unknown as ReturnType<typeof usePlayerStageTattoos>;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePlayerModel).mockReturnValue(model());
  vi.mocked(useEquippedRichClothing).mockReturnValue(clothing());
  vi.mocked(usePlayerStageTattoos).mockReturnValue(tattooQuery());
  save.mockImplementation(async args => ({ appearance: args.appearance, revision: 1 }));
});
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
it('saves detailed face, eye, brow, hair and skin choices as one appearance', async () => {
  render(<PlayerModelEditor />);
  fireEvent.change(screen.getByLabelText('Face shape'), { target: { value: 'angular' } });
  fireEvent.change(screen.getByLabelText('Skin detail'), { target: { value: 'freckles' } });
  fireEvent.click(screen.getByRole('button', { name: 'Eye colour: Green' }));
  fireEvent.change(screen.getByLabelText('Eyebrows'), { target: { value: 'arched' } });
  expect(screen.getByLabelText('Match eyebrow colour to hair')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Match eyebrow colour to hair'));
  fireEvent.click(screen.getByRole('button', { name: 'Eyebrow colour: Chestnut' }));
  fireEvent.change(screen.getByLabelText('Hairstyle'), { target: { value: 'quiff' } });
  fireEvent.change(screen.getByLabelText('Facial hair'), { target: { value: 'goatee' } });
  expect(screen.getByLabelText('Match facial hair colour')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Match facial hair colour'));
  fireEvent.click(screen.getByRole('button', { name: 'Facial hair colour: Ginger' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hair colour: Blue' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ appearance: expect.objectContaining({ head: expect.objectContaining({
    faceShape: 'angular',
    skinDetail: 'freckles',
    eyeColor: '#4f755a',
    eyebrowStyle: 'arched',
    eyebrowColor: '#854b32',
    hairStyle: 'quiff',
    facialHair: 'goatee',
    hair: '#426baa',
    facialHairColor: '#b75e32',
  }) }) })));
});

it('passes currently equipped rich clothing into the shared animated preview', () => {
  const rich = [{ item: { id: 'jacket-1', name: 'Stage Jacket', category: 'jacket' }, variant: { id: 'red', label: 'Red', color: '#990000' } }];
  vi.mocked(useEquippedRichClothing).mockReturnValue(clothing(rich));
  render(<PlayerModelEditor />);
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ richClothing: rich }));
  expect(screen.getByText(/currently equipped Skin Store clothing/i)).toBeVisible();
});


it('saves hats, glasses, lens choices and earrings as one shared stage appearance', async () => {
  render(<PlayerModelEditor />);
  fireEvent.change(screen.getByLabelText('Hat'), { target: { value: 'bucket_hat' } });
  fireEvent.change(screen.getByLabelText('Glasses'), { target: { value: 'aviator' } });
  fireEvent.change(screen.getByLabelText('Lenses'), { target: { value: 'tinted' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lens colour: Blue' }));
  fireEvent.change(screen.getByLabelText('Earrings'), { target: { value: 'drops' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hat colour: Red' }));
  fireEvent.click(screen.getByRole('button', { name: 'Glasses colour: Gold' }));
  fireEvent.click(screen.getByRole('button', { name: 'Earrings colour: Purple' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    appearance: expect.objectContaining({
      accessories: {
        hat: 'bucket_hat',
        hatColor: '#bd3548',
        glasses: 'aviator',
        glassesColor: '#d8ad49',
        lensTint: 'tinted',
        lensColor: '#426baa',
        earrings: 'drops',
        earringColor: '#8055a2',
      },
    }),
  })));
});

it('passes owned tattoo visuals into the same avatar preview', () => {
  const tattoos = [{ id: 'tattoo-1', profile_id: 'character-one', body_slot: 'right_thigh', ink_color: '#111111', quality_score: 90, is_infected: false, category: 'blackwork' }];
  vi.mocked(usePlayerStageTattoos).mockReturnValue(tattooQuery(tattoos));
  render(<PlayerModelEditor />);
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ tattoos }));
  expect(screen.getByText(/1 tattoo from the Tattoo Parlour is rendered/i)).toBeVisible();
});
