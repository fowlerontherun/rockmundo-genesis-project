import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HousingArtwork } from './HousingArtwork';

describe('housing artwork', () => {
  it('labels missing photos as illustrations without inventing property details', () => {
    const { container } = render(<HousingArtwork id="flat" name="City flat" />);
    expect(screen.getByRole('img', { name: 'Room illustration for City flat' })).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Illustration')).toBeVisible();
  });
  it('falls back after a failed photo and retries a replacement URL', () => {
    const { container, rerender } = render(<HousingArtwork id="flat" name="City flat" imageUrl="/old.jpg" />);
    expect(screen.getByRole('img', { name: 'Property image for City flat' })).toBeVisible();
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('img', { name: 'Room illustration for City flat' })).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
    rerender(<HousingArtwork id="flat" name="City flat" imageUrl="/new.jpg" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/new.jpg');
    expect(screen.queryByText('Illustration')).toBeNull();
  });
});
