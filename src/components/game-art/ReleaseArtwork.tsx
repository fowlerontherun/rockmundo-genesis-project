import { useState } from 'react';
import { artworkPalette } from './GameArtwork';
import { cn } from '@/lib/utils';
import './release-art.css';

interface ReleaseArtworkProps {
  id: string;
  title: string;
  artist?: string | null;
  artworkUrl?: string | null;
  releaseType?: string | null;
  className?: string;
}

/** A display-only sleeve: never saved over the player's uploaded artwork. */
export function ReleaseArtwork(props: ReleaseArtworkProps) {
  return <ReleaseSleeve key={`${props.id}:${props.artworkUrl || ''}`} {...props} />;
}

function ReleaseSleeve({ id, title, artist, artworkUrl, releaseType, className }: ReleaseArtworkProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!artworkUrl && !failed;
  const type = releaseType === 'album' ? 'ALBUM' : releaseType === 'ep' ? 'EP' : releaseType === 'single' ? 'SINGLE' : 'RELEASE';
  return <div className={cn('release-sleeve', className)} style={artworkPalette(id)} role="img" aria-label={`${showImage ? 'Cover artwork' : 'Default sleeve'} for ${title}${artist ? ` by ${artist}` : ''}`}>
    <div className="release-sleeve__fallback" aria-hidden="true">
      <div className="release-sleeve__grain" />
      <span className="release-sleeve__type">{type}</span>
      <svg viewBox="0 0 160 160" className="release-sleeve__record" focusable="false">
        <circle cx="80" cy="80" r="76" fill="#111018" />
        {[30, 38, 46, 54, 62, 70].map(r => <circle key={r} cx="80" cy="80" r={r} fill="none" stroke="var(--art-accent)" strokeOpacity=".22" />)}
        <circle cx="80" cy="80" r="23" fill="var(--art-highlight)" />
        <circle cx="80" cy="80" r="4" fill="#111018" />
        <path d="M39 24A70 70 0 0 1 105 15L91 51A30 30 0 0 0 62 56Z" fill="#fff" opacity=".08" />
      </svg>
      <div className="release-sleeve__copy"><span>{artist || 'ROCKMUNDO'}</span><strong>{title || 'Untitled release'}</strong></div>
    </div>
    {showImage && <img src={artworkUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" className="release-sleeve__image" onError={() => setFailed(true)} />}
  </div>;
}
