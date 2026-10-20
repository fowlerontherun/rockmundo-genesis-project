import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArtworkImage, FestivalPoster, LearningArtwork } from './GameArtwork';
import { CityArtwork } from './CityArtwork';
const graphics = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('@/hooks/usePageGraphics', () => ({ usePageGraphics: () => graphics }));

describe('game artwork resilience', () => {
  it('falls back after image failure and recovers when the configured URL changes', () => {
    const { container, rerender } = render(<ArtworkImage src="/missing.png" fallback="/fallback.png" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toHaveAttribute('src', '/fallback.png');
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    rerender(<ArtworkImage src="/new.png" fallback="/fallback.png" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/new.png');
  });

  it('keeps real festival information visible when poster art fails', () => {
    const { container } = render(<FestivalPoster id="edition-1" title="Shock Fest" location="London" date="31 Oct 2026" status="on_sale" />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('heading', { name: 'Shock Fest' })).toBeVisible();
    expect(screen.getByText('London')).toBeVisible();
    expect(screen.getByText('31 Oct 2026')).toBeVisible();
    expect(screen.getByText('on sale')).toBeVisible();
  });

  it('uses city-specific admin artwork before generic artwork and handles unavailable configuration', () => {
    graphics.data = [
      { page_key: 'current-city', hero_image_url: '/generic.png' },
      { page_key: 'city:london', banner_image_url: '/london.png' },
    ];
    const { container, rerender } = render(<CityArtwork cityId="london" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/london.png');
    rerender(<CityArtwork cityId="paris" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/generic.png');
    graphics.data = undefined;
    rerender(<CityArtwork cityId="paris" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/hub-tiles/current-city.png');
  });

  it('adds no competing controls or accessible titles to decorative lesson art', () => {
    const { container } = render(<LearningArtwork kind="video" id="lesson" title="Rhythm lesson" subject="Drums" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
