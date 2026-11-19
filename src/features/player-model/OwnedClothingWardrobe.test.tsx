import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OwnedClothingWardrobe } from './OwnedClothingWardrobe';
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/hooks/useSkinStore', () => ({
  useClothingItems: () => ({ data: [
    { id: 'owned', name: 'Stage Jeans', category: 'pants', wearable_slot: 'bottom' },
    { id: 'unowned', name: 'Unowned Tee', category: 't-shirt', wearable_slot: 'top' },
  ] }),
  useOwnedSkins: () => ({ data: [{ item_id: 'owned', item_type: 'clothing', is_equipped: false, selected_variant_key: 'blue', customization_config: { main: '#40566d' } }] }),
  useSaveClothingCustomization: () => ({ mutate, isPending: false, isError: false }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('equips only owned clothes for the selected character while retaining colour choices', () => {
  render(<MemoryRouter><OwnedClothingWardrobe profileId="character-one" /></MemoryRouter>);
  expect(screen.queryByText('Unowned Tee')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Equip' }));
  expect(mutate).toHaveBeenCalledWith({ profileId: 'character-one', itemId: 'owned', variantKey: 'blue', zoneColours: { main: '#40566d' }, equipped: true });
});