import { Headphones } from 'lucide-react';
import { ArtworkImage, artworkPalette } from './GameArtwork';
import './crew-pass.css';

/** Decorative crew card; the adjacent heading supplies the person's name and role. */
export function CrewPassPortrait({ role, src }: { role: string; src?: string | null }) {
  return <div className="crew-pass" style={artworkPalette(role)} aria-hidden="true">
    <div className="crew-pass__fallback"><Headphones strokeWidth={1} /></div>
    <ArtworkImage src={src} className="crew-pass__image" />
    <div className="crew-pass__shade" />
    <div className="crew-pass__lanyard"><span /></div>
    <div className="crew-pass__label"><span className="crew-pass__eyebrow">ROCKMUNDO / CREW</span><strong>{role}</strong></div>
  </div>;
}
