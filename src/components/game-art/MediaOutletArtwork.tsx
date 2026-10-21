import { artworkPalette } from './GameArtwork';
import './media-outlet-art.css';

/** Decorative outlet identity; never implies a published issue or booked appearance. */
export function MediaOutletArtwork({ id, name, kind }: { id: string; name: string; kind: 'podcast' | 'magazine' }) {
  return <div className={`media-outlet-art media-outlet-art--${kind}`} style={artworkPalette(id)} aria-hidden="true">
    <div className="media-outlet-art__halo" />
    {kind === 'podcast' ? <>
      <div className="media-outlet-art__copy"><span>PODCAST</span><strong>{name}</strong></div>
      <svg viewBox="0 0 120 130" className="media-outlet-art__mic" focusable="false">
        <circle cx="60" cy="58" r="50" fill="var(--art-accent)" opacity=".12" />
        <rect x="43" y="14" width="34" height="65" rx="17" fill="var(--art-accent)" />
        <path d="M49 33h22M49 43h22M49 53h22" stroke="var(--art-bg)" strokeWidth="3" />
        <path d="M31 57v6a29 29 0 0 0 58 0v-6M60 92v22m-18 0h36" stroke="var(--art-highlight)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M15 39v30M6 47v14m99-22v30m9-22v14" stroke="var(--art-accent)" strokeWidth="3" opacity=".5" />
      </svg>
    </> : <div className="media-outlet-art__magazine">
      <span className="media-outlet-art__masthead">{name}</span>
      <div className="media-outlet-art__cover-image"><svg viewBox="0 0 100 60" focusable="false"><circle cx="64" cy="25" r="23" fill="var(--art-highlight)" /><path d="m3 60 27-41 28 41 19-25 23 25" fill="var(--art-accent)" /><path d="M10 10h26M10 15h18" stroke="var(--art-accent)" strokeWidth="2" /></svg></div>
      <span className="media-outlet-art__cover-label">MAGAZINE</span>
      <div className="media-outlet-art__cover-lines" />
    </div>}
  </div>;
}
