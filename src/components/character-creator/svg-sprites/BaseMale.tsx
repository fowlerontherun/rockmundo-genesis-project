// SVG Base Male Body - properly aligned for layering
export const BaseMaleSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Head */}
    <ellipse cx="256" cy="100" rx="55" ry="65" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Neck */}
    <rect x="236" y="155" width="40" height="30" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Torso */}
    <path d="M190 185 L180 400 L200 410 L256 420 L312 410 L332 400 L322 185 Z" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Arms */}
    <rect x="155" y="185" width="30" height="150" rx="10" fill="currentColor" className="text-[#f5d0b0]" />
    <rect x="327" y="185" width="30" height="150" rx="10" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Hands */}
    <ellipse cx="170" cy="350" rx="18" ry="22" fill="currentColor" className="text-[#f5d0b0]" />
    <ellipse cx="342" cy="350" rx="18" ry="22" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Underwear */}
    <path d="M200 410 L180 450 L190 500 L220 510 L256 500 L292 510 L322 500 L332 450 L312 410 Z" fill="#666" />
    {/* Legs */}
    <rect x="195" y="500" width="50" height="220" rx="10" fill="currentColor" className="text-[#f5d0b0]" />
    <rect x="267" y="500" width="50" height="220" rx="10" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Feet */}
    <ellipse cx="220" cy="730" rx="35" ry="15" fill="currentColor" className="text-[#f5d0b0]" />
    <ellipse cx="292" cy="730" rx="35" ry="15" fill="currentColor" className="text-[#f5d0b0]" />
  </svg>
);
