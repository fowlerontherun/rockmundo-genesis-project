// SVG Hair Layers - properly aligned for layering on 512x1024 canvas

export const MohawkHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Mohawk spikes */}
    <path d="M256 30 L240 60 L250 55 L256 25 L262 55 L272 60 Z" fill="#e63946" />
    <path d="M256 10 L245 45 L252 40 L256 5 L260 40 L267 45 Z" fill="#e63946" />
    <path d="M256 45 L235 75 L248 70 L256 40 L264 70 L277 75 Z" fill="#e63946" />
    {/* Hair base */}
    <path d="M210 80 L200 110 L220 130 L256 135 L292 130 L312 110 L302 80 Q256 60 210 80" fill="#e63946" />
    {/* Shaved sides */}
    <ellipse cx="205" cy="100" rx="15" ry="25" fill="#d4a574" opacity="0.7" />
    <ellipse cx="307" cy="100" rx="15" ry="25" fill="#d4a574" opacity="0.7" />
  </svg>
);

export const AfroHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Big afro shape */}
    <ellipse cx="256" cy="80" rx="95" ry="80" fill="#2d1810" />
    {/* Texture details */}
    <circle cx="200" cy="60" r="20" fill="#3d2820" />
    <circle cx="256" cy="40" r="22" fill="#3d2820" />
    <circle cx="312" cy="60" r="20" fill="#3d2820" />
    <circle cx="180" cy="90" r="18" fill="#3d2820" />
    <circle cx="332" cy="90" r="18" fill="#3d2820" />
    <circle cx="220" cy="30" r="15" fill="#3d2820" />
    <circle cx="292" cy="30" r="15" fill="#3d2820" />
  </svg>
);

export const EmoHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Side-swept fringe covering one eye */}
    <path d="M200 70 L180 130 L256 145 L320 90 L300 60 Q256 50 200 70" fill="#1a1a1a" />
    {/* Long side fringe */}
    <path d="M180 80 L165 140 L175 155 L200 160 L210 120 Z" fill="#1a1a1a" />
    {/* Back hair */}
    <path d="M200 60 L185 165 L210 170 L256 175 L302 170 L327 165 L312 60 Q256 45 200 60" fill="#1a1a1a" />
    {/* Purple highlights */}
    <path d="M190 85 L175 135 L185 130 L195 90 Z" fill="#8b5cf6" />
    <path d="M210 75 L200 125 L210 120 L215 80 Z" fill="#8b5cf6" />
  </svg>
);

export const PixieHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Short pixie cut */}
    <path d="M200 55 L190 85 L195 120 L210 130 L256 135 L302 130 L317 120 L322 85 L312 55 Q256 45 200 55" fill="#f5a623" />
    {/* Textured top */}
    <path d="M215 50 L205 70 L220 80 L235 65 L225 50 Z" fill="#e09520" />
    <path d="M245 45 L235 65 L256 75 L277 65 L267 45 Z" fill="#e09520" />
    <path d="M280 50 L270 70 L285 80 L300 65 L290 50 Z" fill="#e09520" />
    {/* Side wisps */}
    <path d="M195 90 L185 110 L195 115 L200 100 Z" fill="#f5a623" />
    <path d="M317 90 L327 110 L317 115 L312 100 Z" fill="#f5a623" />
  </svg>
);
