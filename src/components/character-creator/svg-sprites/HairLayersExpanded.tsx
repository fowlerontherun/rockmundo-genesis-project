// SVG Hair Layers Expanded - 16 additional styles for 512x1024 canvas
// All positioned on crown (Y=20-70) to avoid covering eyes (Y=90)

export const LibertySpikesSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Multiple spikes */}
    <path d="M210 -10 L200 35 L220 40 Z" fill="#22c55e" />
    <path d="M235 -25 L225 30 L245 35 Z" fill="#22c55e" />
    <path d="M256 -35 L246 25 L266 25 Z" fill="#22c55e" />
    <path d="M277 -25 L267 30 L287 35 Z" fill="#22c55e" />
    <path d="M302 -10 L292 35 L312 40 Z" fill="#22c55e" />
    {/* Base band */}
    <path d="M195 40 L190 55 L200 65 L256 68 L312 65 L322 55 L317 40 Q256 30 195 40" fill="#1a1a1a" />
  </svg>
);

export const DreadlocksSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Crown base */}
    <ellipse cx="256" cy="45" rx="60" ry="30" fill="#4a3520" />
    {/* Individual dreads falling down sides (not covering face) */}
    <path d="M195 50 L185 70 L180 95 L178 75" stroke="#4a3520" strokeWidth="8" strokeLinecap="round" />
    <path d="M210 55 L200 78" stroke="#4a3520" strokeWidth="8" strokeLinecap="round" />
    <path d="M302 55 L312 78" stroke="#4a3520" strokeWidth="8" strokeLinecap="round" />
    <path d="M317 50 L327 70 L332 95 L334 75" stroke="#4a3520" strokeWidth="8" strokeLinecap="round" />
    {/* Back dreads */}
    <path d="M230 60 L225 75" stroke="#3d2815" strokeWidth="7" strokeLinecap="round" />
    <path d="M282 60 L287 75" stroke="#3d2815" strokeWidth="7" strokeLinecap="round" />
  </svg>
);

export const LongRockerSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Crown volume */}
    <path d="M200 35 L190 55 L195 70 L256 75 L317 70 L322 55 L312 35 Q256 25 200 35" fill="#1a1a1a" />
    {/* Long flowing sides (behind shoulders, not on face) */}
    <path d="M190 55 L175 80 L165 120 L170 160 L180 140 L185 100 L195 70" fill="#1a1a1a" />
    <path d="M322 55 L337 80 L347 120 L342 160 L332 140 L327 100 L317 70" fill="#1a1a1a" />
    {/* Texture strands */}
    <path d="M175 90 L170 130" stroke="#2a2a2a" strokeWidth="2" />
    <path d="M337 90 L342 130" stroke="#2a2a2a" strokeWidth="2" />
  </svg>
);

export const MulletSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Business in front - short top */}
    <path d="M205 35 L200 50 L210 65 L256 68 L302 65 L312 50 L307 35 Q256 28 205 35" fill="#6b4423" />
    {/* Party in back - long back hair */}
    <path d="M210 60 L200 80 L195 130 L205 160 L256 165 L307 160 L317 130 L312 80 L302 60" fill="#6b4423" />
    {/* Texture */}
    <path d="M220 100 L215 140" stroke="#5a3a1e" strokeWidth="2" />
    <path d="M256 105 L256 150" stroke="#5a3a1e" strokeWidth="2" />
    <path d="M292 100 L297 140" stroke="#5a3a1e" strokeWidth="2" />
  </svg>
);

export const BuzzCutSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Very short stubble on head */}
    <ellipse cx="256" cy="50" rx="52" ry="30" fill="#2a2a2a" opacity="0.7" />
    {/* Stubble texture dots */}
    <circle cx="230" cy="45" r="2" fill="#1a1a1a" />
    <circle cx="245" cy="40" r="2" fill="#1a1a1a" />
    <circle cx="260" cy="42" r="2" fill="#1a1a1a" />
    <circle cx="275" cy="45" r="2" fill="#1a1a1a" />
    <circle cx="256" cy="55" r="2" fill="#1a1a1a" />
    <circle cx="240" cy="58" r="2" fill="#1a1a1a" />
    <circle cx="272" cy="58" r="2" fill="#1a1a1a" />
  </svg>
);

export const PompadourSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Big pompadour wave */}
    <path d="M210 60 L205 40 L220 15 L256 5 L292 15 L307 40 L302 60 L256 65 Z" fill="#1a1a1a" />
    {/* Side slick */}
    <path d="M200 55 L195 70 L256 75 L317 70 L312 55" fill="#1a1a1a" />
    {/* Highlight wave */}
    <path d="M225 20 Q256 10 287 20" stroke="#3a3a3a" strokeWidth="3" fill="none" />
  </svg>
);

export const UndercutSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Long top flopped to side */}
    <path d="M215 35 L180 55 L185 70 L256 68 L295 65 L300 50 L290 35 Q256 28 215 35" fill="#d4a76a" />
    {/* Shaved sides */}
    <ellipse cx="195" cy="60" rx="12" ry="15" fill="#8b7355" opacity="0.5" />
    <ellipse cx="317" cy="60" rx="12" ry="15" fill="#8b7355" opacity="0.5" />
    {/* Texture */}
    <path d="M200 45 L185 60" stroke="#c49a5c" strokeWidth="2" />
    <path d="M220 40 L200 58" stroke="#c49a5c" strokeWidth="2" />
  </svg>
);

export const BraidsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Crown base */}
    <ellipse cx="256" cy="45" rx="55" ry="28" fill="#1a1a1a" />
    {/* Braids pattern on top */}
    <path d="M210 40 L215 55 L210 70" stroke="#2a2a2a" strokeWidth="4" />
    <path d="M230 38 L235 53 L230 68" stroke="#2a2a2a" strokeWidth="4" />
    <path d="M250 36 L255 51 L250 66" stroke="#2a2a2a" strokeWidth="4" />
    <path d="M270 36 L275 51 L270 66" stroke="#2a2a2a" strokeWidth="4" />
    <path d="M290 38 L295 53 L290 68" stroke="#2a2a2a" strokeWidth="4" />
    {/* Side braids */}
    <path d="M195 55 L185 75" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <path d="M317 55 L327 75" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export const PigtailsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Crown */}
    <path d="M205 35 L200 55 L220 68 L256 70 L292 68 L312 55 L307 35 Q256 28 205 35" fill="#ec4899" />
    {/* Left pigtail */}
    <ellipse cx="185" cy="75" rx="18" ry="25" fill="#ec4899" />
    <path d="M180 95 L175 130 L185 140 L195 130 L190 95" fill="#ec4899" />
    {/* Right pigtail */}
    <ellipse cx="327" cy="75" rx="18" ry="25" fill="#ec4899" />
    <path d="M322 95 L317 130 L327 140 L337 130 L332 95" fill="#ec4899" />
    {/* Bows */}
    <circle cx="185" cy="55" r="8" fill="#fff" />
    <circle cx="327" cy="55" r="8" fill="#fff" />
  </svg>
);

export const MessyBobSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Messy bob shape */}
    <path d="M195 35 L185 50 L180 75 L195 85 L256 88 L317 85 L332 75 L327 50 L317 35 Q256 28 195 35" fill="#9a5d42" />
    {/* Messy strands */}
    <path d="M190 55 L178 70" stroke="#8a4d32" strokeWidth="3" strokeLinecap="round" />
    <path d="M205 45 L195 62" stroke="#8a4d32" strokeWidth="3" strokeLinecap="round" />
    <path d="M307 45 L317 62" stroke="#8a4d32" strokeWidth="3" strokeLinecap="round" />
    <path d="M322 55 L334 70" stroke="#8a4d32" strokeWidth="3" strokeLinecap="round" />
    {/* Highlight */}
    <path d="M220 40 Q256 35 292 40" stroke="#aa6d52" strokeWidth="2" fill="none" />
  </svg>
);

export const CurtainsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Center part with curtains */}
    <path d="M256 30 L210 40 L200 60 L195 80 L210 75 L256 35 L302 75 L317 80 L312 60 L302 40 Z" fill="#6b4423" />
    {/* Back volume */}
    <path d="M200 55 L195 70 L256 75 L317 70 L312 55" fill="#5a3a1e" />
    {/* Part line */}
    <line x1="256" y1="30" x2="256" y2="50" stroke="#4a2a15" strokeWidth="2" />
  </svg>
);

export const ShaggySvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Messy shaggy layers */}
    <path d="M195 35 L185 55 L190 75 L256 80 L322 75 L327 55 L317 35 Q256 25 195 35" fill="#b8956e" />
    {/* Shaggy strands */}
    <path d="M200 50 L188 68" stroke="#a8856e" strokeWidth="4" strokeLinecap="round" />
    <path d="M220 45 L210 65" stroke="#a8856e" strokeWidth="4" strokeLinecap="round" />
    <path d="M240 42 L235 62" stroke="#a8856e" strokeWidth="4" strokeLinecap="round" />
    <path d="M272 42 L277 62" stroke="#a8856e" strokeWidth="4" strokeLinecap="round" />
    <path d="M292 45 L302 65" stroke="#a8856e" strokeWidth="4" strokeLinecap="round" />
    <path d="M312 50 L324 68" stroke="#a8856e" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export const SlickedBackSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Smooth slicked back shape */}
    <path d="M205 45 L200 60 L210 70 L256 72 L302 70 L312 60 L307 45 Q256 35 205 45" fill="#1a1a1a" />
    {/* Gel shine highlights */}
    <path d="M220 50 Q256 45 292 50" stroke="#3a3a3a" strokeWidth="2" fill="none" />
    <path d="M225 58 Q256 54 287 58" stroke="#3a3a3a" strokeWidth="2" fill="none" />
  </svg>
);

export const CornrowsSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Cornrow lines */}
    <path d="M210 40 L205 70" stroke="#1a1a1a" strokeWidth="6" />
    <path d="M225 38 L220 68" stroke="#1a1a1a" strokeWidth="6" />
    <path d="M240 36 L236 66" stroke="#1a1a1a" strokeWidth="6" />
    <path d="M256 35 L256 65" stroke="#1a1a1a" strokeWidth="6" />
    <path d="M272 36 L276 66" stroke="#1a1a1a" strokeWidth="6" />
    <path d="M287 38 L292 68" stroke="#1a1a1a" strokeWidth="6" />
    <path d="M302 40 L307 70" stroke="#1a1a1a" strokeWidth="6" />
    {/* Scalp showing between */}
    <path d="M217 40 L213 68" stroke="#8b6040" strokeWidth="2" />
    <path d="M232 38 L228 66" stroke="#8b6040" strokeWidth="2" />
    <path d="M248 36 L246 65" stroke="#8b6040" strokeWidth="2" />
    <path d="M264 36 L266 65" stroke="#8b6040" strokeWidth="2" />
    <path d="M280 38 L284 66" stroke="#8b6040" strokeWidth="2" />
    <path d="M295 40 L300 68" stroke="#8b6040" strokeWidth="2" />
  </svg>
);

export const VikingSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Wild ginger mane */}
    <path d="M190 30 L175 55 L180 80 L256 85 L332 80 L337 55 L322 30 Q256 18 190 30" fill="#c45a28" />
    {/* Side braids */}
    <path d="M180 60 L170 85 L165 110" stroke="#a04820" strokeWidth="8" strokeLinecap="round" />
    <path d="M332 60 L342 85 L347 110" stroke="#a04820" strokeWidth="8" strokeLinecap="round" />
    {/* Texture */}
    <path d="M200 40 L195 60" stroke="#b04a20" strokeWidth="3" />
    <path d="M256 35 L256 55" stroke="#b04a20" strokeWidth="3" />
    <path d="M312 40 L317 60" stroke="#b04a20" strokeWidth="3" />
  </svg>
);

export const BunSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Hair pulled back */}
    <path d="M205 40 L200 55 L220 68 L256 70 L292 68 L312 55 L307 40 Q256 32 205 40" fill="#5a4030" />
    {/* Bun on top */}
    <ellipse cx="256" cy="25" rx="25" ry="22" fill="#5a4030" />
    {/* Bun texture */}
    <ellipse cx="256" cy="22" rx="18" ry="15" fill="#4a3525" />
    <path d="M245 20 Q256 15 267 20" stroke="#6a5040" strokeWidth="2" fill="none" />
  </svg>
);
