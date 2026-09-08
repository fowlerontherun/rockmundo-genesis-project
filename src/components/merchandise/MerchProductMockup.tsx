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
    <filter id={shadow} x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000" floodOpacity="0.28" />
    </filter>
    <filter id={soft} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" />
    </filter>
  </defs>;

  const seam = "rgba(0,0,0,.24)";
  const highlight = "rgba(255,255,255,.28)";

  const apparel = () => {
    const long = ["long", "hoodie", "crewneck", "football"].includes(shape);
    return <>
      <ellipse cx="300" cy="525" rx="170" ry="24" fill="#000" opacity="0.14" filter={`url(#${soft})`} />
      <g filter={`url(#${shadow})`}>
        <path d={long ? "M206 146 L126 174 L52 332 L125 367 L193 257 L192 501 Q300 532 408 501 L407 257 L475 367 L548 332 L474 174 L394 146 Q350 120 300 120 Q250 120 206 146Z" : "M206 146 L122 185 L72 282 L142 320 L192 250 L192 501 Q300 532 408 501 L408 250 L458 320 L528 282 L478 185 L394 146 Q350 120 300 120 Q250 120 206 146Z"} fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" strokeLinejoin="round" />
        {shape === "hoodie" ? <path d="M224 153 Q236 72 300 66 Q364 72 376 153 L352 194 Q300 169 248 194Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" /> : null}
        {shape === "hoodie" && !back ? <path d="M250 391 Q300 414 350 391 L354 470 Q300 486 246 470Z" fill="none" stroke={seam} strokeWidth="3" opacity="0.75" /> : null}
        {shape === "football" ? <>
          <path d="M190 174 Q300 198 410 174" fill="none" stroke={highlight} strokeWidth="18" opacity="0.55" />
          <path d="M201 462 Q300 486 399 462" fill="none" stroke={highlight} strokeWidth="10" opacity="0.38" />
          <path d="M252 145 Q300 184 348 145" fill="none" stroke={seam} strokeWidth="5" />
        </> : null}
        <path d={back ? "M265 143 Q300 165 335 143" : "M264 139 Q300 186 336 139"} fill="none" stroke={seam} strokeWidth="5" strokeLinecap="round" />
        <path d="M217 175 Q232 300 218 474" fill="none" stroke={highlight} strokeWidth="10" opacity="0.23" />
        <path d="M383 175 Q367 300 382 474" fill="none" stroke="#000" strokeWidth="9" opacity="0.08" />
        <path d="M278 172 Q300 180 322 172" fill="none" stroke="#fff" strokeWidth="4" opacity="0.18" />
      </g>
    </>;
  };

  const tote = <>
    <ellipse cx="300" cy="525" rx="180" ry="22" fill="#000" opacity="0.13" filter={`url(#${soft})`} />
    <g filter={`url(#${shadow})`}>
      <path d="M142 198 H458 L482 510 Q300 540 118 510Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M216 205 Q215 104 300 104 Q385 104 384 205" fill="none" stroke={color} strokeWidth="25" />
      <path d="M216 205 Q215 104 300 104 Q385 104 384 205" fill="none" stroke={seam} strokeWidth="3" opacity="0.5" />
      <path d="M154 228 Q300 246 446 228" fill="none" stroke={highlight} strokeWidth="8" opacity="0.3" />
      <path d="M145 235 V480" stroke="#fff" strokeWidth="5" opacity="0.13" />
    </g>
  </>;

  const mug = <>
    <ellipse cx="292" cy="492" rx="145" ry="22" fill="#000" opacity="0.16" filter={`url(#${soft})`} />
    <g filter={`url(#${shadow})`}>
      <path d="M158 180 H410 V426 Q410 472 364 481 H206 Q158 473 158 426Z" fill={`url(#${glass})`} stroke={seam} strokeWidth="4" />
      <path d="M408 235 Q526 237 514 340 Q507 414 411 397" fill="none" stroke={color} strokeWidth="31" />
      <path d="M408 235 Q526 237 514 340 Q507 414 411 397" fill="none" stroke={seam} strokeWidth="4" />
      <path d="M184 200 V430" stroke="#fff" strokeWidth="13" opacity="0.25" strokeLinecap="round" />
      <ellipse cx="284" cy="182" rx="126" ry="16" fill="#fff" opacity="0.12" stroke={seam} strokeWidth="3" />
    </g>
  </>;

  const pint = <>
    <ellipse cx="300" cy="511" rx="110" ry="19" fill="#000" opacity="0.13" filter={`url(#${soft})`} />
    <g filter={`url(#${shadow})`}>
      <path d="M210 116 H390 L370 494 Q300 520 230 494Z" fill={`url(#${glass})`} stroke={seam} strokeWidth="4" />
      <ellipse cx="300" cy="117" rx="90" ry="14" fill="#fff" opacity="0.22" stroke={seam} strokeWidth="3" />
      <path d="M238 142 L254 465" stroke="#fff" strokeWidth="10" opacity="0.24" strokeLinecap="round" />
      <path d="M353 144 L340 462" stroke="#000" strokeWidth="7" opacity="0.08" />
    </g>
  </>;

  const bottle = <>
    <ellipse cx="300" cy="519" rx="104" ry="18" fill="#000" opacity="0.13" filter={`url(#${soft})`} />
    <g filter={`url(#${shadow})`}>
      <rect x="264" y="72" width="72" height="74" rx="15" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M236 145 Q252 128 264 126 H336 Q348 128 364 145 L392 480 Q300 518 208 480Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M236 165 H364" stroke={highlight} strokeWidth="7" opacity="0.28" />
      <path d="M244 187 Q258 336 246 456" fill="none" stroke="#fff" strokeWidth="10" opacity="0.2" />
    </g>
  </>;

  const cap = <>
    <ellipse cx="300" cy="421" rx="190" ry="29" fill="#000" opacity="0.12" filter={`url(#${soft})`} />
    <g filter={`url(#${shadow})`}>
      <path d="M134 337 Q140 161 300 148 Q460 161 466 337 Q300 395 134 337Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M300 151 V351" stroke={seam} strokeWidth="3" opacity="0.55" />
      <path d="M300 163 Q220 208 202 332" fill="none" stroke="#fff" strokeWidth="6" opacity="0.16" />
      <path d="M311 349 Q451 336 530 386 Q449 433 285 383Z" fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <circle cx="300" cy="153" r="10" fill={color} stroke={seam} strokeWidth="3" />
    </g>
  </>;

  const flat = <>
    <ellipse cx="300" cy="526" rx="175" ry="18" fill="#000" opacity="0.11" filter={`url(#${soft})`} />
    <g filter={`url(#${shadow})`}>
      <rect x="112" y="54" width="376" height="466" rx={shape === "poster" ? 4 : 18} fill={`url(#${fabric})`} stroke={seam} strokeWidth="4" />
      <path d="M132 76 H468" stroke="#fff" strokeWidth="7" opacity="0.18" />
    </g>
  </>;

  return <svg viewBox="0 0 600 600" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true">
    {defs}
    {shape === "tote" ? tote : shape === "mug" ? mug : shape === "glass" ? pint : shape === "bottle" ? bottle : shape === "cap" ? cap : shape === "poster" || shape === "flat" ? flat : apparel()}
  </svg>;
};
