import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from './appearance';
import { StarterWardrobe } from './StarterWardrobe';

afterEach(cleanup);
it('edits and swaps both dyes while preserving the garment and its pattern', () => {
  const changed = vi.fn();
  function Wardrobe() {
    const [appearance, setAppearance] = useState(() => {
      const value = defaultAppearance();
      value.equipment.top = { itemId: 'starter.top.sundress', color: '#426baa', pattern: 'dots' };
      return value;
    });
    return <StarterWardrobe slot="top" appearance={appearance} onChange={value => { setAppearance(value); changed(value); }} />;
  }
  render(<Wardrobe />);
  expect(screen.getByRole('img', { name: 'Tops dots preview' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tops second colour: Hot pink' }));
  fireEvent.click(screen.getByRole('button', { name: 'Swap top colours' }));
  expect(changed.mock.lastCall?.[0].equipment.top).toEqual({ itemId: 'starter.top.sundress', color: '#ed4495', secondaryColor: '#426baa', pattern: 'dots' });
  fireEvent.change(screen.getByLabelText('top pattern'), { target: { value: 'original' } });
  expect(screen.queryByRole('button', { name: 'Swap top colours' })).not.toBeInTheDocument();
  expect(changed.mock.lastCall?.[0].equipment.top.secondaryColor).toBe('#426baa');
});

it('uses the displayed default accent when swapping for the first time', () => {
  const appearance = defaultAppearance();
  appearance.equipment.bottom.pattern = 'checks';
  const changed = vi.fn();
  render(<StarterWardrobe slot="bottom" appearance={appearance} onChange={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Swap bottom colours' }));
  expect(changed.mock.lastCall?.[0].equipment.bottom).toEqual({ ...appearance.equipment.bottom, color: '#eee8db', secondaryColor: appearance.equipment.bottom.color });
  expect(changed.mock.lastCall?.[0].equipment.top).toEqual(appearance.equipment.top);
});

it('does not reset a custom dye when the selected garment is clicked again', () => {
  const appearance = defaultAppearance();
  appearance.equipment.top = { itemId: 'starter.top.plain-black', color: '#90c9eb', pattern: 'dots', secondaryColor: '#ed4495' };
  const changed = vi.fn();
  render(<StarterWardrobe slot="top" appearance={appearance} onChange={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Plain black T-shirt' }));
  expect(changed).not.toHaveBeenCalled();
});

it('preserves the pattern and accent on item switches, and honours keep-colour for the main dye', () => {
  const appearance = defaultAppearance();
  appearance.equipment.top = { itemId: 'starter.top.plain-black', color: '#90c9eb', pattern: 'checks', secondaryColor: '#ed4495' };
  const changed = vi.fn();
  render(<StarterWardrobe slot="top" appearance={appearance} onChange={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Plain white T-shirt' }));
  expect(changed.mock.lastCall?.[0].equipment.top).toEqual({ ...appearance.equipment.top, itemId: 'starter.top.plain-white', color: '#eee8db' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Keep my colour when switching items' }));
  fireEvent.click(screen.getByRole('button', { name: 'Plain white T-shirt' }));
  expect(changed.mock.lastCall?.[0].equipment.top).toEqual({ ...appearance.equipment.top, itemId: 'starter.top.plain-white' });
});
