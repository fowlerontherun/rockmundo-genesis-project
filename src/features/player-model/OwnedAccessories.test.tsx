import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { OwnedAccessories } from './OwnedAccessories';
import { useClothingItems, useOwnedSkins, useSaveClothingCustomization, type ClothingItem } from '@/hooks/useSkinStore';

vi.mock('@/hooks/useSkinStore', () => ({ useClothingItems: vi.fn(), useOwnedSkins: vi.fn(), useSaveClothingCustomization: vi.fn() }));
afterEach(cleanup);
it('only offers owned hats/glasses and preserves their variant and colours when equipping or removing', () => {
  const mutate = vi.fn();
  vi.mocked(useClothingItems).mockReturnValue({ data: [
    { id: 'hat', name: 'Tour cap', category: 'hat' },
    { id: 'glasses', name: 'Stage glasses', category: 'eyewear' },
    { id: 'unowned', name: 'Unowned hat', category: 'hat' },
  ] as ClothingItem[] } as ReturnType<typeof useClothingItems>);
  vi.mocked(useOwnedSkins).mockReturnValue({ data: [
    { item_id: 'hat', item_type: 'clothing', is_equipped: false, selected_variant_key: 'blue', customization_config: { main: '#426baa' } },
    { item_id: 'glasses', item_type: 'clothing', is_equipped: true, selected_variant_key: 'gold', customization_config: {} },
  ] } as ReturnType<typeof useOwnedSkins>);
  vi.mocked(useSaveClothingCustomization).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useSaveClothingCustomization>);
  const view = render(<MemoryRouter><OwnedAccessories profileId="character-one" /></MemoryRouter>);
  expect(screen.queryByText('Unowned hat')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Equip Tour cap' }));
  expect(mutate).toHaveBeenLastCalledWith({ profileId: 'character-one', itemId: 'hat', variantKey: 'blue', zoneColours: { main: '#426baa' }, equipped: true });
  view.rerender(<MemoryRouter><OwnedAccessories profileId="character-two" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Stage glasses' }));
  expect(mutate).toHaveBeenLastCalledWith({ profileId: 'character-two', itemId: 'glasses', variantKey: 'gold', zoneColours: {}, equipped: false });
});
