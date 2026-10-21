import type { ReactNode } from 'react';
import { Music2 } from 'lucide-react';
import { ArtworkImage, artworkPalette } from './GameArtwork';
import './tour-poster.css';

export function TourPoster({ id, name, band, logo, dates, cancelled, badges }: {
  id: string;
  name: string;
  band: string;
  logo?: string | null;
  dates: string;
  cancelled?: boolean;
  badges: ReactNode;
}) {
  return <div className={`tour-poster${cancelled ? ' tour-poster--cancelled' : ''}`} style={artworkPalette(id)}>
    <div className="tour-poster__art" aria-hidden="true">
      <ArtworkImage src="/hub-tiles/tour-manager.png" className="tour-poster__photo" />
      <div className="tour-poster__shade" />
      <div className="tour-poster__rings" />
    </div>
    <div className="tour-poster__content">
      <div className="tour-poster__top">
        <span className="tour-poster__eyebrow">ROCKMUNDO / TOUR</span>
        <div className="tour-poster__badges">{badges}</div>
      </div>
      <div className="tour-poster__identity">
        <div className="tour-poster__logo" aria-hidden="true">
          <Music2 className="h-7 w-7" />
          <ArtworkImage src={logo} className="tour-poster__logo-image" />
        </div>
        <p className="tour-poster__band">{band}</p>
      </div>
      <h3 className="tour-poster__title">{name}</h3>
      <p className="tour-poster__dates">{dates}</p>
    </div>
  </div>;
}
