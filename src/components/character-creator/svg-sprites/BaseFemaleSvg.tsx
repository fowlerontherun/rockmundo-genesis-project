// SVG Base Female Body - properly aligned for layering
export const BaseFemaleSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Head */}
    <ellipse cx="256" cy="100" rx="50" ry="60" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Neck */}
    <rect x="240" y="152" width="32" height="28" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Torso - feminine shape */}
    <path d="M200 180 L185 250 L195 350 L210 400 L256 420 L302 400 L317 350 L327 250 L312 180 Z" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Sports bra */}
    <path d="M205 200 L200 260 L256 270 L312 260 L307 200 Z" fill="#666" />
    {/* Arms */}
    <rect x="160" y="185" width="26" height="140" rx="8" fill="currentColor" className="text-[#f5d0b0]" />
    <rect x="326" y="185" width="26" height="140" rx="8" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Hands */}
    <ellipse cx="173" cy="340" rx="16" ry="20" fill="currentColor" className="text-[#f5d0b0]" />
    <ellipse cx="339" cy="340" rx="16" ry="20" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Underwear */}
    <path d="M210 400 L195 440 L200 490 L230 500 L256 495 L282 500 L312 490 L317 440 L302 400 Z" fill="#666" />
    {/* Legs */}
    <rect x="200" y="490" width="45" height="220" rx="10" fill="currentColor" className="text-[#f5d0b0]" />
    <rect x="267" y="490" width="45" height="220" rx="10" fill="currentColor" className="text-[#f5d0b0]" />
    {/* Feet */}
    <ellipse cx="222" cy="720" rx="32" ry="12" fill="currentColor" className="text-[#f5d0b0]" />
    <ellipse cx="290" cy="720" rx="32" ry="12" fill="currentColor" className="text-[#f5d0b0]" />
  </svg>
);
