import type { ReactNode } from 'react';
import { ArtworkImage, artworkPalette } from './GameArtwork';
import './rehearsal-art.css';

/** Shared, decorative room artwork. Session facts and controls remain ordinary HTML. */
export function RehearsalSessionHeading({ seed, title, location, status, band }: {
  seed: string;
  title: string;
  location?: string | null;
  status: ReactNode;
  band?: string;
}) {
  return <div className="rehearsal-heading" style={artworkPalette(seed)}>
    <div className="rehearsal-heading__art" aria-hidden="true">
      <ArtworkImage src="/hub-tiles/rehearsals.png" className="rehearsal-heading__image" />
      <div className="rehearsal-heading__shade" />
      <svg className="rehearsal-heading__speaker" viewBox="0 0 80 120" focusable="false">
        <rect x="4" y="4" width="72" height="112" rx="6" fill="var(--art-bg)" stroke="var(--art-accent)" strokeWidth="2" />
        <circle cx="40" cy="37" r="20" fill="none" stroke="var(--art-accent)" strokeWidth="2" />
        <circle cx="40" cy="37" r="8" fill="var(--art-accent)" />
        <circle cx="40" cy="85" r="23" fill="none" stroke="var(--art-accent)" strokeWidth="2" />
        <circle cx="40" cy="85" r="10" fill="var(--art-accent)" />
      </svg>
    </div>
    <div className="rehearsal-heading__copy">
      {band && <p className="rehearsal-heading__band">{band}</p>}
      <h3 className="rehearsal-heading__title">{title}</h3>
      {location && <p className="rehearsal-heading__location">{location}</p>}
      <div className="rehearsal-heading__status">{status}</div>
    </div>
  </div>;
}
