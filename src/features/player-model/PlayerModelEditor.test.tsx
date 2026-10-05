vi.mock('./OwnedAccessories', () => ({ OwnedAccessories: () => <div>Your collection</div> }));
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PlayerModelEditor from './PlayerModelEditor';
import { useAvatarMerchWearables } from './useAvatarMerchWearables';
vi.mock('./useAvatarMerchWearables', () => ({ useAvatarMerchWearables: vi.fn() }));
const removeMerch = vi.fn();
import { defaultAppearance, SLOTS, SLOT_LABELS, STARTER_ITEMS, starterItemsForWardrobe } from './appearance';
import { useEquippedRichClothing, usePlayerModel, usePlayerStageTattoos } from './usePlayerModel';

vi.mock('./usePlayerModel', () => ({ usePlayerModel: vi.fn(), useEquippedRichClothing: vi.fn(), usePlayerStageTattoos: vi.fn(), useEquippedStageLuthieryInstruments: () => ({ data: [] }) }));
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
  vi.mocked(useAvatarMerchWearables).mockReturnValue({ band: { data: null, isPending: false }, query: { data: { designs: [], equipped: null }, isPending: false }, equip: { isPending: false, error: null, mutate: removeMerch } } as unknown as ReturnType<typeof useAvatarMerchWearables>);
  vi.mocked(usePlayerModel).mockReturnValue(model());
  vi.mocked(useEquippedRichClothing).mockReturnValue(clothing());
  vi.mocked(usePlayerStageTattoos).mockReturnValue(tattooQuery());
  save.mockImplementation(async args => ({ appearance: args.appearance, revision: 1 }));
});
afterEach(cleanup);
it('previews edits without saving, then persists the selected character and equipped pieces', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Feminine' }));
  fireEvent.click(screen.getByRole('button', { name: 'Outfit' }));
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

it('gives every character the full free starter wardrobe and persists new designs and colours', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Outfit' }));
  for (const slot of SLOTS) {
    const group = screen.getByRole('group', { name: SLOT_LABELS[slot] });
    for (const item of starterItemsForWardrobe(slot)) expect(within(group).getByRole('button', { name: item.label })).toBeEnabled();
    fireEvent.click(within(group).getByRole('button', { name: starterItemsForWardrobe(slot)[0].label }));
    fireEvent.click(within(group).getByRole('button', { name: `${SLOT_LABELS[slot]} colour: Teal` }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  for (const slot of SLOTS) expect(save.mock.calls[0][0].appearance.equipment[slot]).toEqual({ itemId: starterItemsForWardrobe(slot)[0].id, color: '#338b8d' });
});
it('saves topless and muscle definition as independent avatar choices', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Bodybuilder' }));
  fireEvent.click(screen.getByRole('button', { name: 'Outfit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Topless' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    appearance: expect.objectContaining({
      body: expect.objectContaining({ muscle: 'bodybuilder' }),
      equipment: expect.objectContaining({ top: expect.objectContaining({ itemId: 'starter.top.topless' }) }),
    }),
  })));
});

it('saves detailed face, eye, brow, hair and skin choices as one appearance', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Face & hair' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Accessories' }));
  fireEvent.change(screen.getByLabelText('Hat'), { target: { value: 'bucket_hat' } });
  fireEvent.change(screen.getByLabelText('Glasses'), { target: { value: 'aviator' } });
  fireEvent.change(screen.getByLabelText('Lenses'), { target: { value: 'tinted' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lens colour: Blue' }));
  fireEvent.change(screen.getByLabelText('Left earring'), { target: { value: 'drops' } });
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
        earrings: 'none',
        leftEarring: 'drops',
        rightEarring: 'none',
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


it('applies complete basic outfit presets to the live draft', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Outfit' }));
  fireEvent.click(screen.getByRole('button', { name: 'All black' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    appearance: expect.objectContaining({ equipment: expect.objectContaining({
      top: { itemId: 'starter.top.plain-black', color: '#20232b' },
      bottom: { itemId: 'starter.bottom.black-jeans', color: '#20232b' },
      footwear: { itemId: 'starter.footwear.black-boots', color: '#20232b' },
    }) }),
  })));
});

it('explains merch overriding a dress and restores the selected dress without changing the draft', () => {
  const state = model();
  state.query.data!.appearance.equipment.top.itemId = 'starter.top.sundress';
  vi.mocked(usePlayerModel).mockReturnValue(state);
  const merch = useAvatarMerchWearables('character-one');
  vi.mocked(useAvatarMerchWearables).mockReturnValue({ ...merch, query: { ...merch.query, data: { designs: [], equipped: { design_id: 'design', band_id: 'band', design_name: 'Tour tee', product_type: 'Graphic Tee', garment_color: '#ffffff' } } } } as ReturnType<typeof useAvatarMerchWearables>);
  const view = render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Outfit' }));
  expect(screen.getByText(/Band merch “Tour tee” replaces/)).toBeVisible();
  expect(screen.queryByText(/A dress covers your bottoms/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use my selected top or dress' }));
  expect(removeMerch).toHaveBeenCalledWith(null);
  expect(save).not.toHaveBeenCalled();
  vi.mocked(useAvatarMerchWearables).mockReturnValue(merch);
  view.rerender(<PlayerModelEditor />);
  expect(screen.getByText(/A dress covers your bottoms/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Sleeveless sundress' })).toHaveAttribute('aria-pressed', 'true');
});

it('saves independent pattern colours for a dress without changing the selected bottoms', async () => {
  render(<PlayerModelEditor />);
  fireEvent.click(screen.getByRole('button', { name: 'Outfit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sleeveless sundress' }));
  fireEvent.change(screen.getByLabelText('top pattern'), { target: { value: 'dots' } });
  fireEvent.change(screen.getByLabelText('top second colour'), { target: { value: '#ffbb33' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].appearance.equipment.top).toMatchObject({ itemId: 'starter.top.sundress', pattern: 'dots', secondaryColor: '#ffbb33' });
  expect(save.mock.calls[0][0].appearance.equipment.bottom).toEqual(defaultAppearance('character-one').equipment.bottom);
});
