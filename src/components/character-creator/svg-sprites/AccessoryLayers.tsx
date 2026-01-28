// SVG Accessory Layers - properly aligned for layering on 512x1024 canvas

export const BeanieSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Beanie body */}
    <path d="M190 65 L185 95 Q256 110 327 95 L322 65 Q256 50 190 65" fill="#1a1a1a" />
    {/* Beanie fold */}
    <path d="M185 85 Q256 100 327 85 L327 100 Q256 115 185 100 Z" fill="#333" />
    {/* Pom pom */}
    <circle cx="256" cy="40" r="18" fill="#1a1a1a" />
  </svg>
);

export const AviatorGlassesSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Bridge */}
    <path d="M248 88 Q256 92 264 88" stroke="#c9a227" strokeWidth="3" fill="none" />
    {/* Left lens */}
    <ellipse cx="225" cy="92" rx="28" ry="22" fill="#333" fillOpacity="0.6" stroke="#c9a227" strokeWidth="2" />
    {/* Right lens */}
    <ellipse cx="287" cy="92" rx="28" ry="22" fill="#333" fillOpacity="0.6" stroke="#c9a227" strokeWidth="2" />
    {/* Arms */}
    <line x1="195" y1="85" x2="180" y2="82" stroke="#c9a227" strokeWidth="2" />
    <line x1="317" y1="85" x2="332" y2="82" stroke="#c9a227" strokeWidth="2" />
    {/* Gradient reflection */}
    <ellipse cx="218" cy="87" rx="8" ry="5" fill="white" fillOpacity="0.2" />
    <ellipse cx="280" cy="87" rx="8" ry="5" fill="white" fillOpacity="0.2" />
  </svg>
);

export const HighTopsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left shoe */}
    <path d="M180 700 L180 755 L165 760 L160 775 L255 775 L255 755 L250 700 Z" fill="#e63946" />
    <rect x="180" y="755" width="75" height="8" fill="#b82e3b" />
    <circle cx="195" cy="720" r="4" fill="white" />
    <circle cx="195" cy="735" r="4" fill="white" />
    <circle cx="195" cy="750" r="4" fill="white" />
    {/* Sole */}
    <rect x="160" y="773" width="100" height="12" rx="3" fill="white" />
    
    {/* Right shoe */}
    <path d="M262 700 L262 755 L257 760 L257 775 L352 775 L352 755 L337 700 Z" fill="#e63946" />
    <rect x="262" y="755" width="75" height="8" fill="#b82e3b" />
    <circle cx="322" cy="720" r="4" fill="white" />
    <circle cx="322" cy="735" r="4" fill="white" />
    <circle cx="322" cy="750" r="4" fill="white" />
    {/* Sole */}
    <rect x="252" y="773" width="100" height="12" rx="3" fill="white" />
  </svg>
);

export const CargoShortsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Waistband */}
    <path d="M195 405 L180 420 L185 440 L200 445 L256 440 L312 445 L327 440 L332 420 L317 405 Z" fill="#5a5a3a" />
    {/* Left leg - shorts length */}
    <path d="M195 445 L185 500 L190 600 L250 595 L250 500 L240 445 Z" fill="#5a5a3a" />
    {/* Right leg */}
    <path d="M262 445 L262 500 L262 595 L322 600 L327 500 L317 445 Z" fill="#5a5a3a" />
    {/* Cargo pockets */}
    <rect x="195" y="510" width="40" height="50" rx="3" fill="#4a4a2a" />
    <rect x="277" y="510" width="40" height="50" rx="3" fill="#4a4a2a" />
    {/* Pocket flaps */}
    <rect x="195" y="505" width="40" height="10" fill="#5a5a3a" />
    <rect x="277" y="505" width="40" height="10" fill="#5a5a3a" />
  </svg>
);
