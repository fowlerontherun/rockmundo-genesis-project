import { artworkPalette } from './GameArtwork';

/** A decorative street scene, not a photograph or live audience estimate. */
export function BuskingLocationArtwork({ id }: { id: string }) {
  return <div className="h-28 overflow-hidden rounded-md border" style={artworkPalette(id)} aria-hidden="true">
    <svg viewBox="0 0 360 140" className="h-full w-full" preserveAspectRatio="xMidYMid slice" focusable="false">
      <path fill="var(--art-bg)" d="M0 0h360v140H0z" />
      <circle cx="280" cy="34" r="22" fill="var(--art-highlight)" opacity=".3" />
      <path d="M0 109V35h42v74m5 0V19h55v90m8 0V45h38v64m79 0V39h48v70m8 0V54h32v55m8 0V25h37v84" fill="var(--art-accent)" opacity=".15" />
      {[12, 28, 58, 77, 122, 240, 258, 294, 334].map(x => <path key={x} d={`M${x} 60h5v8h-5z M${x} 80h5v8h-5z`} fill="var(--art-highlight)" opacity=".35" />)}
      <path d="M0 110h360v30H0z" fill="#080b18" opacity=".5" />
      <path d="M0 123h360M35 110l-20 30m120-30-5 30m130-30 10 30" stroke="var(--art-accent)" opacity=".2" />
      <path d="M68 110V36m-12 1h24m-22-6h20l-4-12H62z" fill="var(--art-highlight)" stroke="var(--art-highlight)" strokeWidth="2" />
      <ellipse cx="184" cy="124" rx="58" ry="7" fill="var(--art-accent)" opacity=".15" />
      <path d="M162 84c-12-5-20 4-18 13-12 17-1 30 12 28 14 2 23-12 12-28 5-8 3-12-6-13Z" fill="var(--art-highlight)" />
      <path d="m157 94 5-42h7l-7 43" fill="var(--art-accent)" />
      <path d="m162 53 1-12h9l-3 12" fill="var(--art-highlight)" />
      <circle cx="157" cy="104" r="6" fill="var(--art-bg)" />
      <path d="M151 116h13" stroke="var(--art-bg)" strokeWidth="3" />
      <rect x="190" y="87" width="39" height="36" rx="3" fill="var(--art-bg)" stroke="var(--art-accent)" strokeWidth="2" />
      <circle cx="209" cy="106" r="10" fill="none" stroke="var(--art-accent)" opacity=".65" />
      <path d="M246 119V57l-10-6m10 68-10 7m10-7 11 7" fill="none" stroke="var(--art-highlight)" strokeWidth="2" />
      <rect x="224" y="46" width="16" height="6" rx="3" fill="var(--art-accent)" transform="rotate(20 232 49)" />
    </svg>
  </div>;
}
