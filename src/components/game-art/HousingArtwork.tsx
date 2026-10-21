import { useState } from 'react';
import { artworkPalette } from './GameArtwork';

export function HousingArtwork(props: { id: string; name: string; imageUrl?: string | null }) {
  return <HousingArtworkContent key={`${props.id}:${props.imageUrl ?? ''}`} {...props} />;
}

function HousingArtworkContent({ id, name, imageUrl }: { id: string; name: string; imageUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(imageUrl) && !failed;
  return <div className="relative h-36 w-full overflow-hidden rounded-lg border" style={artworkPalette(id)} role="img" aria-label={`${showPhoto ? 'Property image' : 'Room illustration'} for ${name}`}>
    <svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true" focusable="false">
      <path fill="var(--art-bg)" d="M0 0h400v180H0z" />
      <path fill="var(--art-accent)" opacity=".1" d="M0 0h400v130H0z" />
      <path fill="#080b18" opacity=".5" d="M0 130h400v50H0z" />
      <path fill="var(--art-highlight)" opacity=".1" d="m275 100 80 30 45 50H190z" />
      <rect x="255" y="20" width="99" height="83" rx="3" fill="var(--art-accent)" opacity=".7" />
      <path d="M260 25h89v73h-89z" fill="var(--art-bg)" />
      <circle cx="326" cy="44" r="12" fill="var(--art-highlight)" />
      <path d="m260 86 28-29 22 15 19-12 20 21v17h-89z" fill="var(--art-accent)" opacity=".45" />
      <path d="M304 25v73M260 62h89" stroke="var(--art-accent)" strokeWidth="4" />
      <ellipse cx="187" cy="156" rx="116" ry="17" fill="var(--art-highlight)" opacity=".12" />
      <rect x="89" y="83" width="149" height="48" rx="11" fill="var(--art-accent)" opacity=".8" />
      <rect x="79" y="107" width="169" height="39" rx="9" fill="var(--art-accent)" />
      <path d="M96 145v10m133-10v10" stroke="var(--art-highlight)" strokeWidth="5" />
      <path d="M165 88v40M94 128h139" stroke="var(--art-bg)" strokeWidth="2" opacity=".3" />
      <rect x="105" y="94" width="29" height="26" rx="5" fill="var(--art-highlight)" />
      <rect x="197" y="94" width="26" height="26" rx="5" fill="var(--art-bg)" opacity=".6" />
      <path d="M58 128V62m-13 66h26" stroke="var(--art-highlight)" strokeWidth="3" />
      <path d="m43 40-9 25h48l-9-25z" fill="var(--art-highlight)" />
      <path d="M322 143v-36" stroke="var(--art-accent)" strokeWidth="3" />
      <path d="M322 122q-25-1-20-20 22 1 20 20m0-8q0-25 21-22 2 20-21 22" fill="var(--art-accent)" />
      <path d="m307 135 5 22h20l5-22z" fill="var(--art-highlight)" />
      <rect x="122" y="22" width="56" height="39" rx="2" fill="none" stroke="var(--art-highlight)" strokeWidth="3" />
      <path d="m130 50 12-17 12 15 9-9 7 11" stroke="var(--art-accent)" strokeWidth="3" fill="none" />
    </svg>
    {showPhoto && <img src={imageUrl!} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
    {!showPhoto && <span aria-hidden="true" className="absolute bottom-1 right-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] text-slate-200">Illustration</span>}
  </div>;
}
