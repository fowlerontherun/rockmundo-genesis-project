// SVG Hair Layers - FIXED: properly positioned on crown (Y=20-70) for 512x1024 canvas

export const MohawkHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Mohawk spikes - positioned above crown */}
    <path d="M256 -15 L242 15 L250 10 L256 -20 L262 10 L270 15 Z" fill="#e63946" />
    <path d="M256 -5 L246 20 L253 15 L256 -10 L259 15 L266 20 Z" fill="#e63946" />
    <path d="M256 5 L238 30 L250 25 L256 0 L262 25 L274 30 Z" fill="#e63946" />
    {/* Hair base - sits on crown of head */}
    <path d="M215 35 L208 55 L220 65 L256 70 L292 65 L304 55 L297 35 Q256 20 215 35" fill="#e63946" />
    {/* Shaved sides texture */}
    <ellipse cx="210" cy="50" rx="12" ry="18" fill="#d4a574" opacity="0.6" />
    <ellipse cx="302" cy="50" rx="12" ry="18" fill="#d4a574" opacity="0.6" />
  </svg>
);

export const AfroHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Big afro shape - centered on crown */}
    <ellipse cx="256" cy="35" rx="75" ry="55" fill="#2d1810" />
    {/* Texture details */}
    <circle cx="210" cy="25" r="16" fill="#3d2820" />
    <circle cx="256" cy="10" r="18" fill="#3d2820" />
    <circle cx="302" cy="25" r="16" fill="#3d2820" />
    <circle cx="195" cy="50" r="14" fill="#3d2820" />
    <circle cx="317" cy="50" r="14" fill="#3d2820" />
    <circle cx="225" cy="5" r="12" fill="#3d2820" />
    <circle cx="287" cy="5" r="12" fill="#3d2820" />
    {/* Lower fringe just above forehead */}
    <ellipse cx="256" cy="65" rx="55" ry="15" fill="#2d1810" />
  </svg>
);

export const EmoHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Back hair volume */}
    <path d="M200 35 L190 55 L200 70 L256 75 L312 70 L322 55 L312 35 Q256 25 200 35" fill="#1a1a1a" />
    {/* Side-swept fringe - covers forehead but NOT eyes (stops at Y=75) */}
    <path d="M200 40 L185 65 L195 75 L256 78 L280 70 L290 45 L285 35 Q256 30 200 40" fill="#1a1a1a" />
    {/* Long side fringe piece */}
    <path d="M185 50 L175 70 L180 78 L195 80 L200 65 Z" fill="#1a1a1a" />
    {/* Purple highlights */}
    <path d="M190 50 L180 68 L188 65 L195 52 Z" fill="#8b5cf6" />
    <path d="M210 42 L200 62 L208 58 L214 45 Z" fill="#8b5cf6" />
  </svg>
);

export const PixieHairSvg = () => (
  <svg viewBox="0 0 512 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Short pixie cut - sits on crown */}
    <path d="M205 30 L198 50 L205 65 L220 70 L256 72 L292 70 L307 65 L314 50 L307 30 Q256 20 205 30" fill="#f5a623" />
    {/* Textured top pieces */}
    <path d="M220 25 L212 42 L225 50 L238 40 L230 25 Z" fill="#e09520" />
    <path d="M245 20 L238 38 L256 48 L274 38 L267 20 Z" fill="#e09520" />
    <path d="M278 25 L270 42 L283 50 L296 40 L288 25 Z" fill="#e09520" />
    {/* Side wisps at temple level */}
    <path d="M198 55 L192 68 L200 70 L205 60 Z" fill="#f5a623" />
    <path d="M314 55 L320 68 L312 70 L307 60 Z" fill="#f5a623" />
  </svg>
);
