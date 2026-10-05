import { useId, type KeyboardEvent, type ReactNode } from "react";
import { type LuthieryBuildSelection, type LuthieryPartSlot, type LuthieryShape } from "@/data/luthieryWorkbench";

interface LuthieryInstrumentPreviewProps {
  selection: LuthieryBuildSelection;
  shape: LuthieryShape;
  activePart: LuthieryPartSlot;
  onSelectPart: (part: LuthieryPartSlot) => void;
}

const PartGroup = ({ part, activePart, onSelectPart, children }: {
  part: LuthieryPartSlot; activePart: LuthieryPartSlot;
  onSelectPart: (part: LuthieryPartSlot) => void; children: ReactNode;
}) => {
  const activate = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault(); onSelectPart(part);
  };
  return <g role="button" tabIndex={0} aria-label={`Select ${part}`} aria-pressed={activePart === part}
    data-testid={`instrument-part-${part}`} onClick={() => onSelectPart(part)}
    onTouchEnd={() => onSelectPart(part)} onKeyDown={activate}
    className="cursor-pointer outline-none focus-visible:[filter:drop-shadow(0_0_5px_hsl(var(--primary)))]">{children}</g>;
};

export const LuthieryInstrumentPreview = ({ selection, shape, activePart, onSelectPart }: LuthieryInstrumentPreviewProps) => {
  const id = useId().replace(/:/g, "");
  const bass = selection.instrumentKind === "electric_bass";
  const nut = shape.id === "short-scale-bass" ? 328 : bass ? 370 : 344;
  const bridge = 72;
  const scaleLength = nut - bridge;
  const count = bass ? 4 : 6;
  const ebony = selection.parts.fretboard.startsWith("fret-ebony");
  const maple = selection.parts.fretboard === "fret-maple";
  const fretFill = `var(--luth-${maple ? "maple" : ebony ? "ebony" : "rosewood"})`;
  const heelTop = selection.parts.neck === "neck-slim-maple" ? 105 : selection.parts.neck === "neck-chunky-mahogany" ? 101 : 103;
  const heelBottom = 229 - heelTop;
  const neckFill = `var(--luth-${selection.parts.neck.includes("mahogany") ? "mahogany" : selection.parts.neck.includes("korina") ? "korina" : "maple"})`;
  const hardware = selection.parts.hardware;
  const hardwareFill = `var(--luth-${hardware === "hw-gold" ? "gold" : hardware === "hw-black" ? "black" : hardware === "hw-aged" ? "nickel" : "chrome"})`;
  const single = ["elec-single", "elec-alnico", "elec-jazz"].includes(selection.parts.electronics);
  const p90 = selection.parts.electronics === "elec-p90";
  const pickupCount = single && !bass && selection.parts.electronics !== "elec-jazz" ? 3 : 2;
  const pickupFill = selection.parts.electronics === "elec-boutique" ? "var(--luth-gold)" : single || p90 ? "var(--luth-ivory)" : "var(--luth-black)";
  const stroke = (part: LuthieryPartSlot) => activePart === part ? "hsl(var(--primary))" : "var(--luth-edge)";
  const natural = selection.finishId === "finish-natural";
  const worn = selection.finishId === "finish-worn";
  const grainFill = `var(--luth-${selection.parts.body.includes("mahogany") ? "mahogany" : selection.parts.body.includes("korina") ? "korina" : "alder"})`;
  return <svg viewBox="10 28 435 165" role="group" aria-label={`Interactive preview of ${shape.name} ${bass ? "bass" : "guitar"}`}
    className="mx-auto h-auto w-full max-w-[680px]" data-testid="luthiery-instrument-preview">
    <defs>
      <clipPath id={`${id}-body`}><path d={shape.bodyPath} /></clipPath>
      <linearGradient id={`${id}-paint`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="var(--luth-highlight)" stopOpacity=".45" />
        <stop offset=".35" stopColor={natural ? grainFill : selection.colour} />
        <stop offset="1" stopColor={natural ? grainFill : selection.colour} stopOpacity=".85" />
      </linearGradient>
      <radialGradient id={`${id}-burst`}><stop offset=".45" stopColor="var(--luth-amber)" /><stop offset=".8" stopColor={selection.colour} /><stop offset="1" stopColor="var(--luth-edge)" /></radialGradient>
      <pattern id={`${id}-grain`} width="11" height="22" patternUnits="userSpaceOnUse">
        <path d="M0 2 C9 6 1 14 11 20 M0 8 C6 12 5 18 11 22" fill="none" stroke={grainFill} strokeOpacity={natural ? .8 : .24} strokeWidth=".7" />
      </pattern>
      <pattern id={`${id}-flake`} width="5" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".5" fill="var(--luth-highlight)" opacity=".6" /></pattern>
    </defs>
    <PartGroup part="body" {...{ activePart, onSelectPart }}>
      <path d={shape.bodyPath} fill={selection.finishId === "finish-burst" ? `url(#${id}-burst)` : `url(#${id}-paint)`} stroke={stroke("body")} strokeWidth={activePart === "body" ? 2 : 1.2} />
      <g clipPath={`url(#${id}-body)`} pointerEvents="none">
        <path d={shape.bodyPath} fill={`url(#${id}-grain)`} />
        {selection.finishId === "finish-metalflake" && <path d={shape.bodyPath} fill={`url(#${id}-flake)`} />}
        {worn && <path d="M34 119 Q43 151 72 157 M39 91 L42 104 M77 151 L86 151" fill="none" stroke={grainFill} strokeWidth="4" />}
        {(selection.finishId === "finish-gloss" || natural || selection.parts.body === "body-carved-mahogany") && <path d={shape.bodyPath} transform="translate(9 9) scale(.91)" fill="none" stroke="var(--luth-highlight)" strokeWidth="1.2" opacity=".35" />}
        {selection.finishId === "finish-artwork" && selection.decal.id !== "none" && <g data-testid="instrument-decal" transform={`translate(${40 + selection.decal.x * .95} ${65 + selection.decal.y * .95}) rotate(${selection.decal.rotation}) scale(${selection.decal.scale / 100})`} fill={selection.decal.colour}>
          {selection.decal.id === "lightning" && <path d="M-4 -19 L11 -4 L4 -3 L11 19 L-12 3 L-3 1 Z" />}
          {selection.decal.id === "star" && <polygon points="0,-19 5,-6 19,-6 8,2 12,17 0,8 -12,17 -8,2 -19,-6 -5,-6" />}
          {selection.decal.id === "stripes" && <g transform="rotate(-18)"><rect x="-15" y="-22" width="7" height="44" /><rect x="0" y="-22" width="7" height="44" /></g>}
          {selection.decal.id === "target" && <g fill="none" stroke={selection.decal.colour} strokeWidth="3"><circle r="18" /><circle r="10" /><circle r="2" /></g>}
        </g>}
        {(shape.id === "semi-hollow" || selection.parts.body === "body-chambered-alder") && <path d="M74 76 C66 66 61 82 71 86 Q82 89 78 100 M65 139 C58 135 58 147 68 149 Q77 150 74 159" fill="none" stroke="var(--luth-edge)" strokeWidth="3" />}
      </g>
    </PartGroup>
    <PartGroup part="neck" {...{ activePart, onSelectPart }}>
      <path d={`M137 ${heelTop} L${nut} 107 L${nut} 122 L137 ${heelBottom} Z`} fill={neckFill} stroke={stroke("neck")} strokeWidth="1.5" />
      <path d={`M${nut} 107 L${nut + 12} 100 L${nut + 55} 101 Q${nut + 66} 113 ${nut + 53} 130 L${nut + 13} 125 L${nut} 122 Z`} fill={neckFill} stroke={stroke("neck")} strokeWidth="1.5" />
    </PartGroup>
    <PartGroup part="fretboard" {...{ activePart, onSelectPart }}>
      <path d={`M139 105 L${nut} 108 L${nut} 121 L139 124 Z`} fill={fretFill} stroke={stroke("fretboard")} />
      {Array.from({ length: 22 }, (_, i) => {
        const fret = i + 1; const x = nut - scaleLength * (1 - Math.pow(2, -fret / 12));
        const half = 6.5 + (nut - x) / scaleLength * 4;
        const inlay = [3, 5, 7, 9, 12, 15, 17, 19, 21].includes(fret);
        const previous = nut - scaleLength * (1 - Math.pow(2, -(fret - 1) / 12));
        return <g key={fret}><line data-fret={fret} x1={x} x2={x} y1={114.5 - half} y2={114.5 + half} stroke="var(--luth-chrome)" strokeWidth=".8" />
          {inlay && selection.parts.fretboard !== "fret-ebony-clean" && (selection.parts.fretboard === "fret-rosewood-block" ? <rect x={x + 2} y="109.5" width={Math.max(2, previous - x - 4)} height="10" fill="var(--luth-ivory)" /> : <g fill={maple ? "var(--luth-edge)" : "var(--luth-ivory)"}><circle cx={(x + previous) / 2} cy={fret === 12 ? 111.5 : 114.5} r="1.5" />{fret === 12 && <circle cx={(x + previous) / 2} cy="117.5" r="1.5" />}</g>)}
        </g>;
      })}
      <path d={`M${nut} 106 L${nut} 123`} stroke="var(--luth-ivory)" strokeWidth="2" />
    </PartGroup>
    <PartGroup part="electronics" {...{ activePart, onSelectPart }}>
      {Array.from({ length: pickupCount }, (_, i) => <g key={i}>
        <rect x={pickupCount === 3 ? 90 + i * 18 : 92 + i * 30} y="102" width={single ? 7 : p90 ? 11 : 14} height="25" rx="2" fill={pickupFill} stroke={stroke("electronics")} strokeWidth="1.5" />
        {selection.parts.electronics !== "elec-active" && Array.from({ length: count }, (_, pole) => <circle key={pole} cx={(pickupCount === 3 ? 90 + i * 18 : 92 + i * 30) + (single ? 3.5 : 7)} cy={105 + pole * 19 / (count - 1)} r=".9" fill="var(--luth-chrome)" />)}
      </g>)}
      <path d="M95 138 L99 143" stroke={hardwareFill} strokeWidth="2" />
    </PartGroup>
    <PartGroup part="hardware" {...{ activePart, onSelectPart }}>
      <rect x="67" y="101" width={hardware === "hw-floyd" ? 17 : 11} height="27" rx="2" fill={hardwareFill} stroke={stroke("hardware")} strokeWidth="1.5" />
      {Array.from({ length: count }, (_, i) => <g key={i}><rect x="69" y={104 + i * 21 / (count - 1)} width="7" height="1.6" fill="var(--luth-edge)" /><path d={`M${nut + 13 + i * 7} 103 v-7`} stroke={hardwareFill} strokeWidth="2" /><ellipse cx={nut + 13 + i * 7} cy="94" rx="3" ry="2.5" fill={hardwareFill} /></g>)}
      {[84, 104].map((x, i) => <g key={x}><circle cx={x} cy={145 + i * 3} r="3.8" fill={hardwareFill} stroke="var(--luth-edge)" /><path d={`M${x} ${141 + i * 3} v3`} stroke="var(--luth-edge)" /></g>)}
      {(hardware === "hw-trem" || hardware === "hw-floyd") && <path d="M78 126 L95 149 L112 149" fill="none" stroke={hardwareFill} strokeWidth="2" />}
    </PartGroup>
    <g pointerEvents="none" data-testid="instrument-strings">
      {Array.from({ length: count }, (_, i) => <path key={i} d={`M${bridge} ${104 + i * 21 / (count - 1)} L${nut} ${109 + i * 11 / (count - 1)} L${nut + 13 + i * 7} 103`} fill="none" stroke="var(--luth-string)" strokeOpacity=".85" strokeWidth={bass ? .8 + i * .12 : .45 + i * .08} />)}
    </g>
  </svg>;
};
