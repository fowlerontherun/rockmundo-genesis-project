// SVG Face Feature Layers - properly aligned for layering on 512x1024 canvas

export const NeutralEyesSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left eye */}
    <ellipse cx="230" cy="90" rx="18" ry="10" fill="white" />
    <circle cx="230" cy="90" r="7" fill="#4a3728" />
    <circle cx="232" cy="88" r="2" fill="white" />
    {/* Right eye */}
    <ellipse cx="282" cy="90" rx="18" ry="10" fill="white" />
    <circle cx="282" cy="90" r="7" fill="#4a3728" />
    <circle cx="284" cy="88" r="2" fill="white" />
    {/* Eyebrows */}
    <path d="M210 75 Q230 70 250 78" stroke="#3d2820" strokeWidth="4" fill="none" />
    <path d="M262 78 Q282 70 302 75" stroke="#3d2820" strokeWidth="4" fill="none" />
  </svg>
);

export const AngryEyesSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Left eye - narrowed */}
    <ellipse cx="230" cy="92" rx="18" ry="7" fill="white" />
    <circle cx="230" cy="92" r="6" fill="#4a3728" />
    {/* Right eye - narrowed */}
    <ellipse cx="282" cy="92" rx="18" ry="7" fill="white" />
    <circle cx="282" cy="92" r="6" fill="#4a3728" />
    {/* Angry eyebrows */}
    <path d="M210 82 Q230 72 250 80" stroke="#3d2820" strokeWidth="5" fill="none" />
    <path d="M262 80 Q282 72 302 82" stroke="#3d2820" strokeWidth="5" fill="none" />
  </svg>
);

export const SmallNoseSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Simple nose shape */}
    <path d="M256 100 L250 118 L245 122 Q256 128 267 122 L262 118 Z" fill="#e5c0a0" stroke="#d4a574" strokeWidth="1" />
  </svg>
);

export const NeutralMouthSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Neutral mouth line */}
    <path d="M235 140 Q256 145 277 140" stroke="#b8756b" strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
);

export const SmileMouthSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Smiling mouth */}
    <path d="M232 138 Q256 155 280 138" stroke="#b8756b" strokeWidth="4" strokeLinecap="round" fill="none" />
    {/* Teeth hint */}
    <path d="M240 140 Q256 148 272 140" fill="white" />
  </svg>
);

export const BeardSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Full beard */}
    <path d="M200 130 L195 155 L200 170 L220 185 L256 195 L292 185 L312 170 L317 155 L312 130 Q256 145 200 130" fill="#3d2820" />
    {/* Mustache */}
    <path d="M225 132 Q256 140 287 132 Q256 148 225 132" fill="#2d1810" />
    {/* Texture */}
    <ellipse cx="220" cy="165" rx="12" ry="8" fill="#4d3830" />
    <ellipse cx="256" cy="175" rx="15" ry="10" fill="#4d3830" />
    <ellipse cx="292" cy="165" rx="12" ry="8" fill="#4d3830" />
  </svg>
);
