import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from './appearance';
import { OutfitLooks } from './OutfitLooks';

afterEach(cleanup);

it('applies the displayed patterned look and clears old patterns on its plain pieces', () => {
  const appearance = defaultAppearance();
  appearance.equipment.top.pattern = 'stripes';
  appearance.equipment.footwear.pattern = 'dots';
  const onChange = vi.fn();
  render(<OutfitLooks appearance={appearance} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Checked encore' }));
  const equipment = onChange.mock.lastCall?.[0].equipment;
  expect(equipment.bottom).toEqual({ itemId: 'starter.bottom.pleated-skirt', color: '#722f46', pattern: 'checks', secondaryColor: '#20232b' });
  expect(equipment.top).toEqual({ itemId: 'starter.top.vest', color: '#eee8db' });
  expect(equipment.footwear).toEqual({ itemId: 'starter.footwear.black-boots', color: '#20232b' });
});
