import { artworkPalette } from './GameArtwork';
import './radio-station-art.css';

export function RadioStationArtwork({ id, name, frequency }: { id: string; name: string; frequency?: string | null }) {
  return <div className="radio-station-art" style={artworkPalette(id)}>
    <div className="radio-station-art__speaker" aria-hidden="true">
      <svg viewBox="0 0 100 100" focusable="false">
        <circle cx="50" cy="50" r="45" fill="var(--art-bg)" stroke="var(--art-accent)" strokeWidth="2" />
        {[35, 26, 17].map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="var(--art-accent)" opacity=".3" />)}
        <circle cx="50" cy="50" r="9" fill="var(--art-accent)" opacity=".8" />
      </svg>
    </div>
    <div className="radio-station-art__display">
      <p className="radio-station-art__name">{name}</p>
      {frequency?.trim() && <p className="radio-station-art__frequency"><span>Frequency</span> {frequency}</p>}
      <div className="radio-station-art__scale" aria-hidden="true" />
    </div>
    <div className="radio-station-art__knobs" aria-hidden="true"><span /><span /></div>
  </div>;
}
