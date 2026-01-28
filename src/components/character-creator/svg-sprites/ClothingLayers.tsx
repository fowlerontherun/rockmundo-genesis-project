// SVG Clothing Layers - properly aligned for layering on 512x1024 canvas

export const SkinnyJeansSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband */}
    <path d="M195 405 L180 420 L185 440 L200 445 L256 440 L312 445 L327 440 L332 420 L317 405 Z" fill="#1a1a2e" />
    {/* Left leg */}
    <path d="M195 445 L185 500 L190 700 L200 720 L245 715 L250 500 L240 445 Z" fill="#1a1a2e" />
    {/* Right leg */}
    <path d="M262 445 L262 500 L267 715 L312 720 L322 700 L327 500 L317 445 Z" fill="#1a1a2e" />
    {/* Seams/details */}
    <line x1="220" y1="445" x2="220" y2="710" stroke="#333" strokeWidth="2" />
    <line x1="292" y1="445" x2="292" y2="710" stroke="#333" strokeWidth="2" />
  </svg>
);

export const CombatBootsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left boot */}
    <path d="M175 695 L175 750 L165 755 L165 770 L250 770 L250 750 L245 695 Z" fill="#111" />
    <rect x="175" y="700" width="70" height="8" fill="#333" />
    <rect x="175" y="715" width="70" height="8" fill="#333" />
    <rect x="175" y="730" width="70" height="8" fill="#333" />
    {/* Right boot */}
    <path d="M262 695 L262 750 L262 755 L262 770 L347 770 L347 755 L347 750 L337 695 Z" fill="#111" />
    <rect x="267" y="700" width="70" height="8" fill="#333" />
    <rect x="267" y="715" width="70" height="8" fill="#333" />
    <rect x="267" y="730" width="70" height="8" fill="#333" />
    {/* Soles */}
    <rect x="160" y="765" width="95" height="15" rx="3" fill="#222" />
    <rect x="257" y="765" width="95" height="15" rx="3" fill="#222" />
  </svg>
);

export const BandTeeSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main shirt body */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#1a1a1a" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 280 L175 285 L185 260 Z" fill="#1a1a1a" />
    <path d="M327 185 L357 195 L362 280 L337 285 L327 260 Z" fill="#1a1a1a" />
    {/* Neckline */}
    <path d="M220 180 Q256 195 292 180" stroke="#333" strokeWidth="3" fill="none" />
    {/* Skull graphic */}
    <circle cx="256" cy="290" r="35" fill="#ddd" />
    <ellipse cx="244" cy="285" rx="8" ry="10" fill="#1a1a1a" />
    <ellipse cx="268" cy="285" rx="8" ry="10" fill="#1a1a1a" />
    <ellipse cx="256" cy="300" rx="4" ry="6" fill="#1a1a1a" />
    <path d="M240 315 Q256 325 272 315" stroke="#1a1a1a" strokeWidth="3" fill="none" />
  </svg>
);

export const LeatherJacketSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left side */}
    <path d="M180 185 L140 195 L135 340 L155 345 L170 400 L190 410 L230 415 L235 200 Z" fill="#2a2a2a" />
    {/* Right side */}
    <path d="M332 185 L372 195 L377 340 L357 345 L342 400 L322 410 L282 415 L277 200 Z" fill="#2a2a2a" />
    {/* Collar left */}
    <path d="M200 175 L175 185 L180 220 L210 230 L220 195 Z" fill="#3a3a3a" />
    {/* Collar right */}
    <path d="M312 175 L337 185 L332 220 L302 230 L292 195 Z" fill="#3a3a3a" />
    {/* Center opening (shows shirt beneath) */}
    <path d="M230 195 L230 415 L256 420 L282 415 L282 195 Z" fill="transparent" />
    {/* Zipper line */}
    <line x1="235" y1="200" x2="235" y2="410" stroke="#888" strokeWidth="3" />
    <line x1="277" y1="200" x2="277" y2="410" stroke="#888" strokeWidth="3" />
    {/* Studs */}
    <circle cx="195" cy="240" r="4" fill="#ccc" />
    <circle cx="195" cy="260" r="4" fill="#ccc" />
    <circle cx="317" cy="240" r="4" fill="#ccc" />
    <circle cx="317" cy="260" r="4" fill="#ccc" />
  </svg>
);

export const HoodieSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Hood back */}
    <ellipse cx="256" cy="120" rx="80" ry="50" fill="#555" />
    {/* Main body */}
    <path d="M175 175 L165 400 L195 410 L256 420 L317 410 L347 400 L337 175 Z" fill="#555" />
    {/* Sleeves */}
    <path d="M175 180 L145 195 L140 320 L165 325 L175 290 Z" fill="#555" />
    <path d="M337 180 L367 195 L372 320 L347 325 L337 290 Z" fill="#555" />
    {/* Pocket */}
    <rect x="200" y="330" width="112" height="60" rx="5" fill="#444" />
    {/* Hood strings */}
    <line x1="230" y1="200" x2="230" y2="280" stroke="#888" strokeWidth="3" />
    <line x1="282" y1="200" x2="282" y2="280" stroke="#888" strokeWidth="3" />
    <circle cx="230" cy="285" r="6" fill="#888" />
    <circle cx="282" cy="285" r="6" fill="#888" />
  </svg>
);
