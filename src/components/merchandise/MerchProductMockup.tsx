import { useId } from "react";

interface MerchProductMockupProps {
  shape: string;
  color: string;
  area?: string;
  className?: string;
}

const normaliseArea = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

export const MerchProductMockup = ({ shape, color, area = "front", className = "" }: MerchProductMockupProps) => {
  const id = useId().replace(/:/g, "");
  const back = normaliseArea(area) === "back";
  const fabric = `${id}-fabric`;
  const glass = `${id}-glass`;
  const metal = `${id}-metal`;
  const shadow = `${id}-shadow`;
  const soft = `${id}-soft`;

  const defs = <defs>
    <linearGradient id={fabric} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
      <stop offset="0.2" stopColor={color} />
      <stop offset="0.65" stopColor={color} />
      <stop offset="1" stopColor="#000" stopOpacity="0.28" />
    </linearGradient>
    <linearGradient id={glass} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
      <stop offset="0.2" stopColor={color} stopOpacity="0.72" />
      <stop offset="0.72" stopColor={color} stopOpacity="0.92" />
      <stop offset="1" stopColor="#fff" stopOpacity="0.28" />
    </linearGradient>
    <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f8fafc" />
      <stop offset="0.45" stopColor="#94a3b8" />
      <stop offset="0.7" stopColor="#e2e8f0" />
      <stop offset="1" stopColor="#64748b" />
    </linearGradient>
    <filter id={shadow} x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000" floodOpacity="0.28" />
    </filter>
    <filter id={soft} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" />
    </filter>
  </defs>;

  const seam = "rgba(0,0,0,.24)";
  const highlight = "rgba(255,255,255,.28)";
  const ground = (rx = 170, cy = 525) => <ellipse cx="300" cy={cy} rx={rx} ry="22" fill="#000" opacity="0.13" filter={`url(#${soft})`} />;

  const apparel = () => {
    const long = ["long", "hoodie", "crewneck", "football", "jacket"].includes(shape);
    return <>
      {ground()}
      <g filter={`url(#${shadow})`}>
        <path d={long ? "M206 146 L126 174 L52 332 L125 367 L193 257 L192 501 Q300 532 408 501 L407 257 L475 367 L548 332 L474 174 L394 146 Q350 120 300 120 Q250 120 206 146Z" : "M206 146 L122 185 L72 282 L142 320 L192 250 L192 501 Q300 532 408 501 L408 250 L458 320 L528 282 L478 185 L394 146 Q350 120 300 120 Q250 120 206 146Z"} fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" strokeLinejoin="round" />
        {shape === "hoodie" ? <path d="M224 153 Q236 72 300 66 Q364 72 376 153 L352 194 Q300 169 248 194Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" /> : null}
        {shape === "hoodie" && !back ? <path d="M250 391 Q300 414 350 391 L354 470 Q300 486 246 470Z" fill="none" stroke={seam} strokeWidth="3" opacity="0.75" /> : null}
        {shape === "football" ? <>
          <path d="M190 174 Q300 198 410 174" fill="none" stroke={highlight} strokeWidth="18" opacity="0.55" />
          <path d="M201 462 Q300 486 399 462" fill="none" stroke={highlight} strokeWidth="10" opacity="0.38" />
          <path d="M252 145 Q300 184 348 145" fill="none" stroke={seam} strokeWidth="5" />
        </> : null}
        {shape === "jacket" ? <>
          <path d="M300 154 V503" stroke="#0f172a" strokeOpacity="0.5" strokeWidth="8" />
          <path d="M221 195 L278 239 L248 285" fill="none" stroke={highlight} strokeWidth="8" opacity="0.3" />
          <path d="M379 195 L322 239 L352 285" fill="none" stroke="#000" strokeWidth="7" opacity="0.12" />
          <path d="M216 424 L269 405" stroke={seam} strokeWidth="5" />
          <path d="M384 424 L331 405" stroke={seam} strokeWidth="5" />
        </> : null}
        <path d={back ? "M265 143 Q300 165 335 143" : "M264 139 Q300 186 336 139"} fill="none" stroke={seam} strokeWidth="5" strokeLinecap="round" />
        <path d="M217 175 Q232 300 218 474" fill="none" stroke={highlight} strokeWidth="10" opacity="0.23" />
        <path d="M383 175 Q367 300 382 474" fill="none" stroke="#000" strokeWidth="9" opacity="0.08" />
      </g>
    </>;
  };

  const tote = <>
    {ground(180)}
    <g filter={`url(#${shadow})`}>
      <path d="M142 198 H458 L482 510 Q300 540 118 510Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M216 205 Q215 104 300 104 Q385 104 384 205" fill="none" stroke={color} strokeWidth="25" />
      <path d="M216 205 Q215 104 300 104 Q385 104 384 205" fill="none" stroke={seam} strokeWidth="3" opacity="0.5" />
      <path d="M154 228 Q300 246 446 228" fill="none" stroke={highlight} strokeWidth="8" opacity="0.3" />
    </g>
  </>;

  const mug = <>
    {ground(145, 492)}
    <g filter={`url(#${shadow})`}>
      <path d="M158 180 H410 V426 Q410 472 364 481 H206 Q158 473 158 426Z" fill={`url(#${glass})`} stroke={seam} strokeWidth="4" />
      <path d="M408 235 Q526 237 514 340 Q507 414 411 397" fill="none" stroke={color} strokeWidth="31" />
      <path d="M408 235 Q526 237 514 340 Q507 414 411 397" fill="none" stroke={seam} strokeWidth="4" />
      <path d="M184 200 V430" stroke="#fff" strokeWidth="13" opacity="0.25" strokeLinecap="round" />
    </g>
  </>;

  const pint = <>
    {ground(110, 511)}
    <g filter={`url(#${shadow})`}>
      <path d="M210 116 H390 L370 494 Q300 520 230 494Z" fill={`url(#${glass})`} stroke={seam} strokeWidth="4" />
      <ellipse cx="300" cy="117" rx="90" ry="14" fill="#fff" opacity="0.22" stroke={seam} strokeWidth="3" />
      <path d="M238 142 L254 465" stroke="#fff" strokeWidth="10" opacity="0.24" strokeLinecap="round" />
    </g>
  </>;

  const bottle = <>
    {ground(104, 519)}
    <g filter={`url(#${shadow})`}>
      <rect x="264" y="72" width="72" height="74" rx="15" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M236 145 Q252 128 264 126 H336 Q348 128 364 145 L392 480 Q300 518 208 480Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M244 187 Q258 336 246 456" fill="none" stroke="#fff" strokeWidth="10" opacity="0.2" />
    </g>
  </>;

  const cap = <>
    {ground(190, 421)}
    <g filter={`url(#${shadow})`}>
      <path d="M134 337 Q140 161 300 148 Q460 161 466 337 Q300 395 134 337Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M300 151 V351" stroke={seam} strokeWidth="3" opacity="0.55" />
      <path d="M311 349 Q451 336 530 386 Q449 433 285 383Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <circle cx="300" cy="153" r="10" fill={color} stroke={seam} strokeWidth="3" />
    </g>
  </>;

  const beanie = <>
    {ground(140, 462)}
    <g filter={`url(#${shadow})`}>
      <path d="M172 348 Q170 136 300 112 Q430 136 428 348 L405 441 Q300 470 195 441Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M184 352 Q300 382 416 352 L407 437 Q300 461 193 437Z" fill={color} stroke={seam} strokeWidth="4" />
      <path d="M220 158 Q300 130 380 158" fill="none" stroke={highlight} strokeWidth="9" opacity="0.25" />
      <path d="M206 389 Q300 411 394 389" fill="none" stroke="#fff" strokeWidth="6" opacity="0.18" />
    </g>
  </>;

  const poster = <>
    {ground(175, 526)}
    <g filter={`url(#${shadow})`}>
      <rect x="112" y="54" width="376" height="466" rx="4" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M132 76 H468" stroke="#fff" strokeWidth="7" opacity="0.18" />
    </g>
  </>;

  const booklet = <>
    {ground(155, 512)}
    <g filter={`url(#${shadow})`} transform="rotate(-4 300 300)">
      <rect x="165" y="75" width="270" height="420" rx="8" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M188 102 H412" stroke="#fff" strokeWidth="7" opacity="0.2" />
      <path d="M190 462 H410" stroke="#000" strokeWidth="3" opacity="0.12" />
      <path d="M180 86 L196 486" stroke="#000" strokeWidth="6" opacity="0.15" />
    </g>
  </>;

  const vinyl = <>
    {ground(175, 500)}
    <g filter={`url(#${shadow})`}>
      <circle cx="325" cy="290" r="176" fill="#101010" stroke="#000" strokeWidth="6" />
      <circle cx="325" cy="290" r="95" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="2" />
      <circle cx="325" cy="290" r="47" fill={color} stroke="#fff" strokeOpacity="0.25" strokeWidth="3" />
      <circle cx="325" cy="290" r="8" fill="#e2e8f0" />
      <rect x="112" y="116" width="286" height="286" rx="5" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M132 138 H378" stroke="#fff" strokeWidth="7" opacity="0.18" />
    </g>
  </>;

  const sticker = <>
    {ground(130, 472)}
    <g filter={`url(#${shadow})`}>
      <path d="M300 112 C418 112 478 188 468 295 C458 405 390 466 300 472 C210 466 142 405 132 295 C122 188 182 112 300 112Z" fill="#fff" stroke="#cbd5e1" strokeWidth="16" />
      <path d="M300 128 C406 128 457 197 448 294 C440 393 379 445 300 451 C221 445 160 393 152 294 C143 197 194 128 300 128Z" fill={`url(#${fabric})`} />
      <path d="M190 171 Q300 137 410 171" fill="none" stroke="#fff" strokeWidth="8" opacity="0.22" />
    </g>
  </>;

  const patch = <>
    {ground(135, 470)}
    <g filter={`url(#${shadow})`}>
      <path d="M300 120 L438 194 L420 390 L300 466 L180 390 L162 194Z" fill={`url(#${fabric})`} stroke="#d1a85b" strokeWidth="16" strokeLinejoin="round" />
      <path d="M300 139 L419 203 L403 378 L300 444 L197 378 L181 203Z" fill="none" stroke="#f6d58a" strokeWidth="4" strokeDasharray="8 6" opacity="0.8" />
    </g>
  </>;

  const pin = <>
    {ground(105, 448)}
    <g filter={`url(#${shadow})`}>
      <circle cx="300" cy="286" r="145" fill={`url(#${metal})`} stroke="#475569" strokeWidth="5" />
      <circle cx="300" cy="286" r="128" fill={`url(#${fabric})`} stroke="#fff" strokeOpacity="0.24" strokeWidth="5" />
      <path d="M208 206 Q300 160 392 206" fill="none" stroke="#fff" strokeWidth="9" opacity="0.2" />
      <path d="M270 430 L300 490 L330 430" fill="none" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
    </g>
  </>;

  const pinSet = <>
    {ground(170, 505)}
    <g filter={`url(#${shadow})`}>
      <rect x="120" y="82" width="360" height="405" rx="18" fill="#1f2937" stroke="#475569" strokeWidth="5" />
      {[[215,210],[385,210],[215,365],[385,365]].map(([cx,cy], index) => <g key={index}>
        <circle cx={cx} cy={cy} r="62" fill={`url(#${metal})`} />
        <circle cx={cx} cy={cy} r="52" fill={color} stroke="#fff" strokeOpacity="0.2" strokeWidth="4" />
      </g>)}
      <path d="M150 112 H450" stroke="#fff" strokeWidth="7" opacity="0.12" />
    </g>
  </>;

  const keyring = <>
    {ground(135, 485)}
    <g filter={`url(#${shadow})`}>
      <circle cx="300" cy="133" r="72" fill="none" stroke={`url(#${metal})`} strokeWidth="22" />
      <circle cx="300" cy="133" r="46" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="4" />
      <path d="M287 198 L270 240" stroke="#64748b" strokeWidth="20" strokeLinecap="round" />
      <path d="M313 198 L330 240" stroke="#94a3b8" strokeWidth="20" strokeLinecap="round" />
      <rect x="185" y="230" width="230" height="230" rx="42" fill={`url(#${fabric})`} stroke={`url(#${metal})`} strokeWidth="12" />
      <path d="M213 256 H387" stroke="#fff" strokeWidth="8" opacity="0.22" />
    </g>
  </>;

  const pick = <>
    {ground(140, 475)}
    <g filter={`url(#${shadow})`}>
      <path d="M300 98 C420 102 474 176 443 286 C417 376 350 437 300 476 C250 437 183 376 157 286 C126 176 180 102 300 98Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="5" />
      <path d="M211 164 Q300 126 389 164" fill="none" stroke="#fff" strokeWidth="9" opacity="0.2" />
      <path d="M300 477 Q350 438 405 376" fill="none" stroke="#000" strokeWidth="8" opacity="0.08" />
    </g>
  </>;

  const lanyard = <>
    {ground(125, 515)}
    <g filter={`url(#${shadow})`}>
      <path d="M210 78 Q152 180 212 322 L270 438" fill="none" stroke={color} strokeWidth="28" strokeLinecap="round" />
      <path d="M390 78 Q448 180 388 322 L330 438" fill="none" stroke={color} strokeWidth="28" strokeLinecap="round" />
      <path d="M210 78 Q152 180 212 322 L270 438" fill="none" stroke="#fff" strokeWidth="5" opacity="0.2" />
      <path d="M390 78 Q448 180 388 322 L330 438" fill="none" stroke="#000" strokeWidth="5" opacity="0.12" />
      <rect x="280" y="400" width="40" height="48" rx="8" fill={`url(#${metal})`} />
      <rect x="205" y="438" width="190" height="115" rx="12" fill={`url(#${glass})`} stroke="#64748b" strokeWidth="5" />
      <rect x="224" y="458" width="152" height="75" rx="6" fill={color} opacity="0.88" />
    </g>
  </>;

  const bundle = <>
    {ground(190, 520)}
    <g filter={`url(#${shadow})`}>
      <rect x="118" y="150" width="364" height="330" rx="28" fill="#171717" stroke="#444" strokeWidth="5" />
      <rect x="137" y="169" width="326" height="292" rx="20" fill={`url(#${fabric})`} opacity="0.96" />
      <rect x="160" y="196" width="122" height="122" rx="8" fill="#111" stroke="#fff" strokeOpacity="0.15" strokeWidth="4" />
      <circle cx="221" cy="257" r="42" fill="#050505" stroke="#333" strokeWidth="4" />
      <rect x="309" y="193" width="126" height="155" rx="9" fill={color} stroke="#fff" strokeOpacity="0.18" strokeWidth="4" />
      <rect x="164" y="350" width="270" height="76" rx="10" fill="#f8fafc" opacity="0.9" />
      <path d="M185 375 H412 M185 397 H365" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
    </g>
  </>;

  const flat = <>
    {ground(175, 526)}
    <g filter={`url(#${shadow})`}>
      <rect x="112" y="54" width="376" height="466" rx="18" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M132 76 H468" stroke="#fff" strokeWidth="7" opacity="0.18" />
    </g>
  </>;

  const content = shape === "tote" ? tote
    : shape === "mug" ? mug
    : shape === "glass" ? pint
    : shape === "bottle" ? bottle
    : shape === "cap" ? cap
    : shape === "beanie" ? beanie
    : shape === "poster" ? poster
    : shape === "booklet" ? booklet
    : shape === "vinyl" ? vinyl
    : shape === "sticker" ? sticker
    : shape === "patch" ? patch
    : shape === "pin" ? pin
    : shape === "pin-set" ? pinSet
    : shape === "keyring" ? keyring
    : shape === "pick" ? pick
    : shape === "lanyard" ? lanyard
    : shape === "bundle" ? bundle
    : shape === "flat" ? flat
    : apparel();

  return <svg viewBox="0 0 600 600" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true">
    {defs}
    {content}
  </svg>;
};