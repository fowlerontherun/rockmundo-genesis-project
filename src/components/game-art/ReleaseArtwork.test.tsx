import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReleaseArtwork } from './ReleaseArtwork';

describe('release sleeves', () => {
  it('identifies missing artwork as a default sleeve, with the real release identity', () => {
    render(<ReleaseArtwork id="album-1" title="Night Shift" artist="War Dogs" releaseType="album" />);
    expect(screen.getByRole('img', { name: 'Default sleeve for Night Shift by War Dogs' })).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('preserves uploaded artwork and falls back after failure', () => {
    const { container } = render(<ReleaseArtwork id="album-1" title="Night Shift" artworkUrl="/cover.png" />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/cover.png');
    expect(img).toHaveAttribute('loading', 'lazy');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Default sleeve for Night Shift' })).toBeVisible();
  });

  it('recovers when an editor supplies a new artwork URL', () => {
    const { container, rerender } = render(<ReleaseArtwork id="album-1" title="Night Shift" artworkUrl="/broken.png" />);
    fireEvent.error(container.querySelector('img')!);
    rerender(<ReleaseArtwork id="album-1" title="Night Shift" artworkUrl="/replacement.png" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/replacement.png');
    expect(screen.getByRole('img', { name: 'Cover artwork for Night Shift' })).toBeVisible();
  });

  it('keeps the same palette when the title is edited and escapes player text', () => {
    const { container, rerender } = render(<ReleaseArtwork id="album-1" title="First title" />);
    const palette = container.firstElementChild?.getAttribute('style');
    rerender(<ReleaseArtwork id="album-1" title="<script>hello</script>" />);
    expect(container.firstElementChild?.getAttribute('style')).toBe(palette);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByRole('img', { name: 'Default sleeve for <script>hello</script>' })).toBeVisible();
  });
});
