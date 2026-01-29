// SVG Clothing Layers Expanded - Additional clothing for 512x1024 canvas

// === SHIRTS ===

export const FlannelShirtSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main shirt body - red plaid base */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#b91c1c" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 280 L175 285 L185 260 Z" fill="#b91c1c" />
    <path d="M327 185 L357 195 L362 280 L337 285 L327 260 Z" fill="#b91c1c" />
    {/* Plaid pattern - horizontal */}
    <line x1="175" y1="220" x2="337" y2="220" stroke="#1a1a1a" strokeWidth="3" />
    <line x1="175" y1="260" x2="337" y2="260" stroke="#1a1a1a" strokeWidth="3" />
    <line x1="175" y1="300" x2="337" y2="300" stroke="#1a1a1a" strokeWidth="3" />
    <line x1="175" y1="340" x2="337" y2="340" stroke="#1a1a1a" strokeWidth="3" />
    <line x1="175" y1="380" x2="337" y2="380" stroke="#1a1a1a" strokeWidth="3" />
    {/* Plaid pattern - vertical */}
    <line x1="210" y1="185" x2="210" y2="410" stroke="#1a1a1a" strokeWidth="3" />
    <line x1="256" y1="185" x2="256" y2="420" stroke="#1a1a1a" strokeWidth="3" />
    <line x1="302" y1="185" x2="302" y2="410" stroke="#1a1a1a" strokeWidth="3" />
    {/* Button placket */}
    <rect x="250" y="190" width="12" height="220" fill="#991b1b" />
  </svg>
);

export const HawaiianShirtSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - bright teal */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#0d9488" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 280 L175 285 L185 260 Z" fill="#0d9488" />
    <path d="M327 185 L357 195 L362 280 L337 285 L327 260 Z" fill="#0d9488" />
    {/* Flowers */}
    <circle cx="210" cy="240" r="15" fill="#f472b6" />
    <circle cx="210" cy="240" r="6" fill="#fbbf24" />
    <circle cx="290" cy="280" r="15" fill="#fb7185" />
    <circle cx="290" cy="280" r="6" fill="#fbbf24" />
    <circle cx="230" cy="350" r="12" fill="#c084fc" />
    <circle cx="230" cy="350" r="5" fill="#fbbf24" />
    <circle cx="280" cy="380" r="12" fill="#f472b6" />
    <circle cx="280" cy="380" r="5" fill="#fbbf24" />
    {/* Leaves */}
    <ellipse cx="200" cy="310" rx="8" ry="15" fill="#22c55e" transform="rotate(-20 200 310)" />
    <ellipse cx="300" cy="340" rx="8" ry="15" fill="#22c55e" transform="rotate(20 300 340)" />
    {/* Open collar */}
    <path d="M220 185 Q256 200 292 185" stroke="#0d9488" strokeWidth="3" fill="none" />
  </svg>
);

export const RippedTeeSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - white with rips */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#f5f5f5" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 280 L175 285 L185 260 Z" fill="#f5f5f5" />
    <path d="M327 185 L357 195 L362 280 L337 285 L327 260 Z" fill="#f5f5f5" />
    {/* Rips/tears */}
    <path d="M200 280 L210 285 L200 290 L215 295 L200 300" stroke="#ddd" strokeWidth="3" fill="none" />
    <path d="M290 320 L305 325 L295 330 L310 335" stroke="#ddd" strokeWidth="3" fill="none" />
    <path d="M240 380 L250 385 L235 390 L255 395" stroke="#ddd" strokeWidth="3" fill="none" />
    {/* Neckline */}
    <path d="M220 180 Q256 195 292 180" stroke="#e5e5e5" strokeWidth="3" fill="none" />
  </svg>
);

export const PoloShirtSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - blue */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#2563eb" />
    {/* Sleeves with bands */}
    <path d="M185 185 L155 195 L150 260 L175 265 L185 240 Z" fill="#2563eb" />
    <path d="M327 185 L357 195 L362 260 L337 265 L327 240 Z" fill="#2563eb" />
    <rect x="148" y="255" width="30" height="8" fill="#1d4ed8" />
    <rect x="335" y="255" width="30" height="8" fill="#1d4ed8" />
    {/* Collar */}
    <path d="M220 175 L200 185 L210 200 L220 195 Z" fill="#1d4ed8" />
    <path d="M292 175 L312 185 L302 200 L292 195 Z" fill="#1d4ed8" />
    {/* Button placket */}
    <rect x="250" y="185" width="12" height="60" fill="#1d4ed8" />
    <circle cx="256" cy="200" r="3" fill="white" />
    <circle cx="256" cy="220" r="3" fill="white" />
    <circle cx="256" cy="240" r="3" fill="white" />
  </svg>
);

export const CropTopSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Short crop top - pink */}
    <path d="M195 185 L185 320 L205 325 L256 330 L307 325 L327 320 L317 185 Z" fill="#ec4899" />
    {/* Sleeves - cap sleeves */}
    <path d="M195 185 L170 195 L168 230 L185 235 L195 210 Z" fill="#ec4899" />
    <path d="M317 185 L342 195 L344 230 L327 235 L317 210 Z" fill="#ec4899" />
    {/* Neckline */}
    <path d="M215 180 Q256 195 297 180" stroke="#db2777" strokeWidth="3" fill="none" />
  </svg>
);

export const TankTopSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Sleeveless tank - black */}
    <path d="M200 185 L190 400 L210 410 L256 420 L302 410 L322 400 L312 185 Z" fill="#1a1a1a" />
    {/* Deep armholes */}
    <path d="M200 185 L195 220 L205 260 L200 185" fill="#1a1a1a" />
    <path d="M312 185 L317 220 L307 260 L312 185" fill="#1a1a1a" />
    {/* Neckline - scoop */}
    <path d="M210 180 Q256 200 302 180" stroke="#2a2a2a" strokeWidth="3" fill="none" />
  </svg>
);

export const TurtleneckSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - black */}
    <path d="M185 195 L175 400 L195 410 L256 420 L317 410 L337 400 L327 195 Z" fill="#1a1a1a" />
    {/* Sleeves */}
    <path d="M185 195 L155 205 L150 280 L175 285 L185 260 Z" fill="#1a1a1a" />
    <path d="M327 195 L357 205 L362 280 L337 285 L327 260 Z" fill="#1a1a1a" />
    {/* High turtleneck */}
    <path d="M210 165 L205 195 L256 200 L307 195 L302 165 Q256 160 210 165" fill="#2a2a2a" />
    <path d="M215 175 Q256 180 297 175" stroke="#1a1a1a" strokeWidth="2" fill="none" />
    <path d="M218 185 Q256 190 294 185" stroke="#1a1a1a" strokeWidth="2" fill="none" />
  </svg>
);

export const JerseySvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - red */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#dc2626" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 280 L175 285 L185 260 Z" fill="#dc2626" />
    <path d="M327 185 L357 195 L362 280 L337 285 L327 260 Z" fill="#dc2626" />
    {/* White stripes */}
    <rect x="175" y="220" width="162" height="15" fill="white" />
    <rect x="175" y="260" width="162" height="15" fill="white" />
    {/* Number */}
    <text x="256" y="350" fontSize="60" fontWeight="bold" fill="white" textAnchor="middle">23</text>
    {/* V-neck */}
    <path d="M220 185 L256 210 L292 185" stroke="#b91c1c" strokeWidth="4" fill="none" />
  </svg>
);

export const TieDyeSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Base - swirling tie-dye */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#fbbf24" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 280 L175 285 L185 260 Z" fill="#fbbf24" />
    <path d="M327 185 L357 195 L362 280 L337 285 L327 260 Z" fill="#fbbf24" />
    {/* Tie-dye swirls */}
    <circle cx="230" cy="280" r="40" fill="#f472b6" opacity="0.7" />
    <circle cx="290" cy="350" r="35" fill="#a855f7" opacity="0.7" />
    <circle cx="256" cy="250" r="30" fill="#22c55e" opacity="0.7" />
    <circle cx="200" cy="360" r="25" fill="#3b82f6" opacity="0.7" />
    <circle cx="310" cy="280" r="25" fill="#ef4444" opacity="0.7" />
    {/* Neckline */}
    <path d="M220 180 Q256 195 292 180" stroke="#f59e0b" strokeWidth="3" fill="none" />
  </svg>
);

export const BlazerShirtSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - navy */}
    <path d="M185 185 L175 400 L195 410 L256 420 L317 410 L337 400 L327 185 Z" fill="#1e3a5f" />
    {/* Sleeves */}
    <path d="M185 185 L155 195 L150 300 L175 305 L185 280 Z" fill="#1e3a5f" />
    <path d="M327 185 L357 195 L362 300 L337 305 L327 280 Z" fill="#1e3a5f" />
    {/* Lapels */}
    <path d="M200 185 L190 200 L210 280 L235 280 L230 195 Z" fill="#15294a" />
    <path d="M312 185 L322 200 L302 280 L277 280 L282 195 Z" fill="#15294a" />
    {/* White shirt underneath */}
    <path d="M230 195 L230 280 L256 290 L282 280 L282 195" fill="white" />
    {/* Tie */}
    <path d="M250 195 L256 220 L262 195 Z" fill="#dc2626" />
    <path d="M248 220 L256 290 L264 220 Z" fill="#dc2626" />
    {/* Buttons */}
    <circle cx="235" cy="320" r="4" fill="#c9a227" />
    <circle cx="235" cy="360" r="4" fill="#c9a227" />
  </svg>
);

export const MeshTopSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Mesh pattern - semi-transparent black */}
    <path d="M195 185 L185 400 L205 410 L256 420 L307 410 L327 400 L317 185 Z" fill="#1a1a1a" opacity="0.5" />
    {/* Mesh grid lines */}
    <g stroke="#1a1a1a" strokeWidth="2" opacity="0.8">
      <line x1="195" y1="220" x2="317" y2="220" />
      <line x1="190" y1="260" x2="322" y2="260" />
      <line x1="187" y1="300" x2="325" y2="300" />
      <line x1="185" y1="340" x2="327" y2="340" />
      <line x1="187" y1="380" x2="325" y2="380" />
      <line x1="210" y1="185" x2="200" y2="410" />
      <line x1="240" y1="185" x2="230" y2="415" />
      <line x1="272" y1="185" x2="282" y2="415" />
      <line x1="302" y1="185" x2="312" y2="410" />
    </g>
    {/* Neckline */}
    <path d="M210 180 Q256 195 302 180" stroke="#1a1a1a" strokeWidth="3" fill="none" />
  </svg>
);

// === JACKETS ===

export const DenimVestSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Vest body - no sleeves */}
    <path d="M190 185 L145 200 L150 220 L180 225 L170 400 L195 410 L230 415 Z" fill="#3b82f6" />
    <path d="M322 185 L367 200 L362 220 L332 225 L342 400 L317 410 L282 415 Z" fill="#3b82f6" />
    {/* Collar */}
    <path d="M200 175 L175 190 L185 215 L210 210 L215 185 Z" fill="#2563eb" />
    <path d="M312 175 L337 190 L327 215 L302 210 L297 185 Z" fill="#2563eb" />
    {/* Center opening */}
    <path d="M230 195 L230 415 L256 420 L282 415 L282 195 Z" fill="transparent" />
    {/* Patches */}
    <rect x="175" cy="300" width="40" height="50" rx="3" fill="#1d4ed8" />
    <rect x="297" y="300" width="40" height="50" rx="3" fill="#1d4ed8" />
    {/* Stitching */}
    <line x1="185" y1="260" x2="225" y2="260" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 2" />
    <line x1="287" y1="260" x2="327" y2="260" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 2" />
  </svg>
);

export const VarsityJacketSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - red */}
    <path d="M180 185 L140 200 L145 380 L175 400 L195 410 L230 415 Z" fill="#dc2626" />
    <path d="M332 185 L372 200 L367 380 L337 400 L317 410 L282 415 Z" fill="#dc2626" />
    {/* Sleeves - white leather */}
    <path d="M180 190 L140 200 L130 340 L160 350 L175 300 Z" fill="#f5f5f5" />
    <path d="M332 190 L372 200 L382 340 L352 350 L337 300 Z" fill="#f5f5f5" />
    {/* Center opening */}
    <path d="M230 195 L230 415 L256 420 L282 415 L282 195 Z" fill="transparent" />
    {/* Collar - white */}
    <path d="M205 175 L190 185 L195 210 L215 205 L220 185 Z" fill="#f5f5f5" />
    <path d="M307 175 L322 185 L317 210 L297 205 L292 185 Z" fill="#f5f5f5" />
    {/* Letter */}
    <text x="256" y="330" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">R</text>
    {/* Snap buttons */}
    <circle cx="235" cy="250" r="5" fill="#c9a227" />
    <circle cx="235" cy="300" r="5" fill="#c9a227" />
    <circle cx="235" cy="350" r="5" fill="#c9a227" />
  </svg>
);

export const MilitaryJacketSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - olive */}
    <path d="M180 185 L140 195 L135 400 L175 410 L230 415 L235 195 Z" fill="#4d5a3a" />
    <path d="M332 185 L372 195 L377 400 L337 410 L282 415 L277 195 Z" fill="#4d5a3a" />
    {/* Sleeves */}
    <path d="M180 185 L140 195 L130 340 L160 350 L175 300 Z" fill="#4d5a3a" />
    <path d="M332 185 L372 195 L382 340 L352 350 L337 300 Z" fill="#4d5a3a" />
    {/* Mandarin collar */}
    <path d="M210 170 L205 195 L256 200 L307 195 L302 170 Q256 165 210 170" fill="#5a6a45" />
    {/* Pockets */}
    <rect x="185" y="280" width="40" height="45" fill="#3d4a2a" />
    <rect x="287" y="280" width="40" height="45" fill="#3d4a2a" />
    <rect x="185" y="340" width="40" height="45" fill="#3d4a2a" />
    <rect x="287" y="340" width="40" height="45" fill="#3d4a2a" />
    {/* Epaulettes */}
    <rect x="140" y="195" width="35" height="8" rx="2" fill="#5a6a45" />
    <rect x="337" y="195" width="35" height="8" rx="2" fill="#5a6a45" />
    {/* Center zip */}
    <line x1="256" y1="200" x2="256" y2="410" stroke="#888" strokeWidth="4" />
  </svg>
);

export const TrenchCoatSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Long coat body - black */}
    <path d="M175 185 L130 195 L120 480 L180 490 L230 495 Z" fill="#1a1a1a" />
    <path d="M337 185 L382 195 L392 480 L332 490 L282 495 Z" fill="#1a1a1a" />
    {/* Sleeves */}
    <path d="M175 185 L130 195 L120 350 L155 360 L170 320 Z" fill="#1a1a1a" />
    <path d="M337 185 L382 195 L392 350 L357 360 L342 320 Z" fill="#1a1a1a" />
    {/* Wide lapels */}
    <path d="M195 175 L160 195 L175 280 L220 275 L225 195 Z" fill="#2a2a2a" />
    <path d="M317 175 L352 195 L337 280 L292 275 L287 195 Z" fill="#2a2a2a" />
    {/* Belt */}
    <rect x="150" y="380" width="212" height="12" fill="#5a4a3a" />
    <rect x="250" y="377" width="12" height="18" fill="#c9a227" />
    {/* Center opening */}
    <path d="M225 195 L225 495 L256 500 L287 495 L287 195 Z" fill="transparent" />
    {/* Double buttons */}
    <circle cx="200" cy="300" r="5" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
    <circle cx="200" cy="340" r="5" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
    <circle cx="312" cy="300" r="5" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
    <circle cx="312" cy="340" r="5" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
  </svg>
);

export const TrackJacketSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - red */}
    <path d="M180 185 L140 195 L135 400 L175 410 L230 415 L235 195 Z" fill="#dc2626" />
    <path d="M332 185 L372 195 L377 400 L337 410 L282 415 L277 195 Z" fill="#dc2626" />
    {/* Sleeves */}
    <path d="M180 185 L140 195 L130 340 L160 350 L175 300 Z" fill="#dc2626" />
    <path d="M332 185 L372 195 L382 340 L352 350 L337 300 Z" fill="#dc2626" />
    {/* White stripes on sleeves */}
    <line x1="140" y1="220" x2="175" y2="245" stroke="white" strokeWidth="6" />
    <line x1="140" y1="235" x2="175" y2="260" stroke="white" strokeWidth="6" />
    <line x1="372" y1="220" x2="337" y2="245" stroke="white" strokeWidth="6" />
    <line x1="372" y1="235" x2="337" y2="260" stroke="white" strokeWidth="6" />
    {/* Stand collar */}
    <path d="M210 170 L205 195 L256 200 L307 195 L302 170 Q256 165 210 170" fill="#b91c1c" />
    {/* Center zip */}
    <line x1="256" y1="195" x2="256" y2="410" stroke="#f5f5f5" strokeWidth="5" />
    {/* Center opening */}
    <path d="M235 195 L235 415 L256 420 L277 415 L277 195 Z" fill="transparent" />
  </svg>
);

export const CardiganSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Main body - beige */}
    <path d="M180 185 L140 195 L135 400 L175 410 L230 415 L235 195 Z" fill="#d4a574" />
    <path d="M332 185 L372 195 L377 400 L337 410 L282 415 L277 195 Z" fill="#d4a574" />
    {/* Sleeves */}
    <path d="M180 185 L140 195 L130 340 L160 350 L175 300 Z" fill="#d4a574" />
    <path d="M332 185 L372 195 L382 340 L352 350 L337 300 Z" fill="#d4a574" />
    {/* V-neck opening */}
    <path d="M230 195 L256 260 L282 195" fill="#c49464" />
    {/* Center opening */}
    <path d="M235 260 L235 415 L256 420 L277 415 L277 260 Z" fill="transparent" />
    {/* Ribbed edges */}
    <rect x="230" y="260" width="6" height="155" fill="#c49464" />
    <rect x="276" y="260" width="6" height="155" fill="#c49464" />
    {/* Buttons */}
    <circle cx="240" cy="290" r="5" fill="#8b6040" />
    <circle cx="240" cy="330" r="5" fill="#8b6040" />
    <circle cx="240" cy="370" r="5" fill="#8b6040" />
    {/* Cable knit texture */}
    <path d="M190 250 Q195 270 190 290" stroke="#c49464" strokeWidth="2" fill="none" />
    <path d="M210 250 Q215 270 210 290" stroke="#c49464" strokeWidth="2" fill="none" />
    <path d="M302 250 Q307 270 302 290" stroke="#c49464" strokeWidth="2" fill="none" />
    <path d="M322 250 Q327 270 322 290" stroke="#c49464" strokeWidth="2" fill="none" />
  </svg>
);

// === BOTTOMS ===

export const RippedJeansSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband */}
    <path d="M195 405 L180 420 L185 440 L200 445 L256 440 L312 445 L327 440 L332 420 L317 405 Z" fill="#3b82f6" />
    {/* Left leg */}
    <path d="M195 445 L185 500 L190 700 L200 720 L245 715 L250 500 L240 445 Z" fill="#3b82f6" />
    {/* Right leg */}
    <path d="M262 445 L262 500 L267 715 L312 720 L322 700 L327 500 L317 445 Z" fill="#3b82f6" />
    {/* Rips/holes */}
    <ellipse cx="215" cy="540" rx="15" ry="25" fill="#d4a574" />
    <ellipse cx="295" cy="600" rx="18" ry="20" fill="#d4a574" />
    <ellipse cx="220" cy="650" rx="12" ry="18" fill="#d4a574" />
    {/* Frayed edges around holes */}
    <path d="M200 530 L210 535 L200 545" stroke="#60a5fa" strokeWidth="2" />
    <path d="M230 550 L220 545 L230 535" stroke="#60a5fa" strokeWidth="2" />
    <path d="M277 590 L290 595 L280 608" stroke="#60a5fa" strokeWidth="2" />
    <path d="M313 610 L300 605 L310 595" stroke="#60a5fa" strokeWidth="2" />
  </svg>
);

export const LeatherPantsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband */}
    <path d="M195 405 L180 420 L185 440 L200 445 L256 440 L312 445 L327 440 L332 420 L317 405 Z" fill="#1a1a1a" />
    {/* Left leg - tight fit */}
    <path d="M195 445 L188 500 L193 700 L203 720 L240 715 L245 500 L238 445 Z" fill="#1a1a1a" />
    {/* Right leg */}
    <path d="M262 445 L267 500 L272 715 L309 720 L319 700 L324 500 L317 445 Z" fill="#1a1a1a" />
    {/* Shine highlights */}
    <path d="M200 480 Q205 550 200 620" stroke="#333" strokeWidth="4" fill="none" />
    <path d="M275 480 Q280 550 275 620" stroke="#333" strokeWidth="4" fill="none" />
    {/* Seams */}
    <line x1="215" y1="445" x2="215" y2="710" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="297" y1="445" x2="297" y2="710" stroke="#2a2a2a" strokeWidth="2" />
  </svg>
);

export const TrackPantsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband - elastic */}
    <path d="M195 405 L180 420 L185 440 L200 445 L256 440 L312 445 L327 440 L332 420 L317 405 Z" fill="#1a1a1a" />
    {/* Left leg - baggy */}
    <path d="M195 445 L180 500 L175 700 L195 720 L255 715 L260 500 L245 445 Z" fill="#1a1a1a" />
    {/* Right leg */}
    <path d="M258 445 L253 500 L257 715 L317 720 L337 700 L332 500 L317 445 Z" fill="#1a1a1a" />
    {/* White stripes */}
    <line x1="182" y1="460" x2="177" y2="710" stroke="white" strokeWidth="5" />
    <line x1="188" y1="460" x2="183" y2="710" stroke="white" strokeWidth="5" />
    <line x1="330" y1="460" x2="335" y2="710" stroke="white" strokeWidth="5" />
    <line x1="324" y1="460" x2="329" y2="710" stroke="white" strokeWidth="5" />
    {/* Ankle cuffs */}
    <rect x="173" y="700" width="85" height="15" fill="#2a2a2a" />
    <rect x="255" y="700" width="85" height="15" fill="#2a2a2a" />
  </svg>
);

export const PleatedSkirtSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband */}
    <path d="M200 405 L185 420 L190 435 L256 440 L322 435 L327 420 L312 405 Z" fill="#1a1a1a" />
    {/* Pleated skirt - A-line */}
    <path d="M190 435 L160 620 L256 640 L352 620 L322 435 Z" fill="#1a1a1a" />
    {/* Pleats */}
    <line x1="200" y1="440" x2="175" y2="620" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="220" y1="438" x2="200" y2="625" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="240" y1="437" x2="225" y2="630" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="256" y1="440" x2="256" y2="640" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="272" y1="437" x2="287" y2="630" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="292" y1="438" x2="312" y2="625" stroke="#2a2a2a" strokeWidth="2" />
    <line x1="312" y1="440" x2="337" y2="620" stroke="#2a2a2a" strokeWidth="2" />
  </svg>
);

export const KiltSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband */}
    <path d="M200 405 L185 420 L190 440 L256 445 L322 440 L327 420 L312 405 Z" fill="#1a5f1a" />
    {/* Kilt body - tartan base */}
    <path d="M190 440 L170 620 L256 640 L342 620 L322 440 Z" fill="#1a5f1a" />
    {/* Tartan pattern - red lines */}
    <line x1="190" y1="480" x2="322" y2="480" stroke="#dc2626" strokeWidth="4" />
    <line x1="180" y1="520" x2="332" y2="520" stroke="#dc2626" strokeWidth="4" />
    <line x1="175" y1="560" x2="337" y2="560" stroke="#dc2626" strokeWidth="4" />
    <line x1="172" y1="600" x2="340" y2="600" stroke="#dc2626" strokeWidth="4" />
    {/* Vertical yellow lines */}
    <line x1="210" y1="440" x2="190" y2="620" stroke="#fbbf24" strokeWidth="2" />
    <line x1="256" y1="445" x2="256" y2="640" stroke="#fbbf24" strokeWidth="2" />
    <line x1="302" y1="440" x2="322" y2="620" stroke="#fbbf24" strokeWidth="2" />
    {/* Sporran */}
    <ellipse cx="256" cy="480" rx="25" ry="30" fill="#5a4a3a" />
    <rect x="240" y="450" width="32" height="15" rx="3" fill="#c9a227" />
    {/* Tassels */}
    <line x1="245" y1="505" x2="240" y2="530" stroke="#5a4a3a" strokeWidth="4" />
    <line x1="256" y1="510" x2="256" y2="535" stroke="#5a4a3a" strokeWidth="4" />
    <line x1="267" y1="505" x2="272" y2="530" stroke="#5a4a3a" strokeWidth="4" />
  </svg>
);

export const BellBottomsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband - high waist */}
    <path d="M200 395 L185 410 L190 440 L200 445 L256 440 L312 445 L322 440 L327 410 L312 395 Z" fill="#3b82f6" />
    {/* Left leg - flared bottom */}
    <path d="M200 445 L195 500 L190 620 L150 730 L270 725 L250 500 L245 445 Z" fill="#3b82f6" />
    {/* Right leg */}
    <path d="M258 445 L262 500 L267 620 L362 730 L242 725 L262 500 L267 445 Z" fill="#3b82f6" />
    {/* Seams */}
    <line x1="220" y1="445" x2="210" y2="725" stroke="#2563eb" strokeWidth="2" />
    <line x1="292" y1="445" x2="302" y2="725" stroke="#2563eb" strokeWidth="2" />
    {/* Flare shadow */}
    <path d="M150 720 Q210 710 270 720" stroke="#1d4ed8" strokeWidth="3" fill="none" />
    <path d="M242 720 Q302 710 362 720" stroke="#1d4ed8" strokeWidth="3" fill="none" />
  </svg>
);

// === FOOTWEAR ===

export const CowboyBootsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left boot */}
    <path d="M175 680 L175 745 L155 755 L150 775 L245 775 L250 755 L250 680 Z" fill="#8b4513" />
    <path d="M175 680 L170 660 L180 640 L245 640 L255 660 L250 680 Z" fill="#a0522d" />
    {/* Boot details - stitching */}
    <path d="M185 660 Q210 680 235 660" stroke="#6b3a0a" strokeWidth="2" fill="none" />
    <path d="M190 680 Q210 695 230 680" stroke="#6b3a0a" strokeWidth="2" fill="none" />
    {/* Heel */}
    <rect x="165" y="765" width="30" height="20" fill="#5a3a1a" />
    {/* Toe point */}
    <path d="M240 775 L260 770 L245 775 Z" fill="#8b4513" />
    
    {/* Right boot */}
    <path d="M262 680 L262 745 L262 755 L262 775 L357 775 L362 755 L357 745 L337 680 Z" fill="#8b4513" />
    <path d="M262 680 L257 660 L267 640 L332 640 L342 660 L337 680 Z" fill="#a0522d" />
    {/* Boot details */}
    <path d="M277 660 Q302 680 327 660" stroke="#6b3a0a" strokeWidth="2" fill="none" />
    <path d="M282 680 Q302 695 322 680" stroke="#6b3a0a" strokeWidth="2" fill="none" />
    {/* Heel */}
    <rect x="317" y="765" width="30" height="20" fill="#5a3a1a" />
    {/* Toe point */}
    <path d="M357 775 L377 770 L362 775 Z" fill="#8b4513" />
  </svg>
);

export const PlatformBootsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left boot - tall platform */}
    <path d="M175 660 L175 740 L160 745 L155 790 L255 790 L260 745 L250 740 L250 660 Z" fill="#1a1a1a" />
    {/* Platform sole - thick */}
    <rect x="150" y="780" width="115" height="25" rx="5" fill="#2a2a2a" />
    {/* Buckle straps */}
    <rect x="175" y="680" width="75" height="10" fill="#333" />
    <rect x="240" y="675" width="15" height="20" rx="3" fill="#c9a227" />
    <rect x="175" y="710" width="75" height="10" fill="#333" />
    <rect x="240" y="705" width="15" height="20" rx="3" fill="#c9a227" />
    <rect x="175" y="740" width="75" height="10" fill="#333" />
    <rect x="240" y="735" width="15" height="20" rx="3" fill="#c9a227" />
    
    {/* Right boot */}
    <path d="M262 660 L262 740 L252 745 L257 790 L357 790 L352 745 L337 740 L337 660 Z" fill="#1a1a1a" />
    <rect x="247" y="780" width="115" height="25" rx="5" fill="#2a2a2a" />
    {/* Buckle straps */}
    <rect x="262" y="680" width="75" height="10" fill="#333" />
    <rect x="257" y="675" width="15" height="20" rx="3" fill="#c9a227" />
    <rect x="262" y="710" width="75" height="10" fill="#333" />
    <rect x="257" y="705" width="15" height="20" rx="3" fill="#c9a227" />
    <rect x="262" y="740" width="75" height="10" fill="#333" />
    <rect x="257" y="735" width="15" height="20" rx="3" fill="#c9a227" />
  </svg>
);

export const SandalsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left sandal */}
    <ellipse cx="210" cy="770" rx="50" ry="15" fill="#8b6040" />
    {/* Straps */}
    <path d="M180 760 L180 740 L190 740 L190 760" fill="#6b4020" />
    <path d="M230 760 L230 740 L240 740 L240 760" fill="#6b4020" />
    <path d="M170 768 L250 768" stroke="#6b4020" strokeWidth="6" />
    <path d="M210 758 L210 745" stroke="#6b4020" strokeWidth="8" />
    
    {/* Right sandal */}
    <ellipse cx="302" cy="770" rx="50" ry="15" fill="#8b6040" />
    {/* Straps */}
    <path d="M272 760 L272 740 L282 740 L282 760" fill="#6b4020" />
    <path d="M322 760 L322 740 L332 740 L332 760" fill="#6b4020" />
    <path d="M262 768 L342 768" stroke="#6b4020" strokeWidth="6" />
    <path d="M302 758 L302 745" stroke="#6b4020" strokeWidth="8" />
  </svg>
);

export const DressShoesSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left shoe */}
    <path d="M175 720 L175 755 L165 760 L160 775 L255 775 L260 760 L250 755 L250 720 Z" fill="#1a1a1a" />
    {/* Pointed toe */}
    <path d="M255 775 L275 770 L260 775 Z" fill="#1a1a1a" />
    {/* Shine */}
    <ellipse cx="210" cy="745" rx="25" ry="8" fill="#333" />
    {/* Sole */}
    <rect x="158" y="770" width="102" height="8" rx="2" fill="#2a2a2a" />
    
    {/* Right shoe */}
    <path d="M262 720 L262 755 L252 760 L252 775 L347 775 L352 760 L347 755 L337 720 Z" fill="#1a1a1a" />
    {/* Pointed toe */}
    <path d="M347 775 L367 770 L352 775 Z" fill="#1a1a1a" />
    {/* Shine */}
    <ellipse cx="302" cy="745" rx="25" ry="8" fill="#333" />
    {/* Sole */}
    <rect x="250" y="770" width="102" height="8" rx="2" fill="#2a2a2a" />
  </svg>
);

export const SneakersSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left sneaker - white */}
    <path d="M175 705 L175 755 L160 760 L155 775 L255 775 L260 760 L250 755 L250 705 Z" fill="#f5f5f5" />
    {/* Swoosh/stripe */}
    <path d="M175 735 Q210 720 250 740" stroke="#1a1a1a" strokeWidth="5" fill="none" />
    {/* Toe cap */}
    <ellipse cx="235" cy="760" rx="25" ry="12" fill="#e5e5e5" />
    {/* Sole */}
    <rect x="153" y="770" width="107" height="12" rx="3" fill="#1a1a1a" />
    {/* Laces */}
    <circle cx="200" cy="720" r="3" fill="#1a1a1a" />
    <circle cx="200" cy="735" r="3" fill="#1a1a1a" />
    
    {/* Right sneaker */}
    <path d="M262 705 L262 755 L252 760 L257 775 L357 775 L352 760 L337 755 L337 705 Z" fill="#f5f5f5" />
    {/* Swoosh/stripe */}
    <path d="M262 735 Q297 720 337 740" stroke="#1a1a1a" strokeWidth="5" fill="none" />
    {/* Toe cap */}
    <ellipse cx="327" cy="760" rx="25" ry="12" fill="#e5e5e5" />
    {/* Sole */}
    <rect x="252" y="770" width="107" height="12" rx="3" fill="#1a1a1a" />
    {/* Laces */}
    <circle cx="297" cy="720" r="3" fill="#1a1a1a" />
    <circle cx="297" cy="735" r="3" fill="#1a1a1a" />
  </svg>
);

export const CreepersSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left creeper - thick platform */}
    <path d="M170 710 L170 750 L160 755 L155 785 L260 785 L265 755 L255 750 L255 710 Z" fill="#1a1a1a" />
    {/* Leopard print pattern on upper */}
    <ellipse cx="195" cy="730" rx="8" ry="5" fill="#d4a574" />
    <ellipse cx="215" cy="725" rx="6" ry="4" fill="#d4a574" />
    <ellipse cx="235" cy="735" rx="7" ry="4" fill="#d4a574" />
    <ellipse cx="205" cy="745" rx="5" ry="4" fill="#d4a574" />
    {/* Crepe sole - very thick */}
    <rect x="152" y="775" width="118" height="20" rx="5" fill="#8b6040" />
    
    {/* Right creeper */}
    <path d="M257 710 L257 750 L247 755 L247 785 L352 785 L357 755 L347 750 L347 710 Z" fill="#1a1a1a" />
    {/* Leopard print pattern */}
    <ellipse cx="282" cy="730" rx="8" ry="5" fill="#d4a574" />
    <ellipse cx="302" cy="725" rx="6" ry="4" fill="#d4a574" />
    <ellipse cx="322" cy="735" rx="7" ry="4" fill="#d4a574" />
    <ellipse cx="292" cy="745" rx="5" ry="4" fill="#d4a574" />
    {/* Crepe sole */}
    <rect x="242" y="775" width="118" height="20" rx="5" fill="#8b6040" />
  </svg>
);
