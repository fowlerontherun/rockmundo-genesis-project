import type { KeyboardEvent, ReactNode } from "react";

import {
  type LuthieryBuildSelection,
  type LuthieryPartSlot,
  type LuthieryShape,
} from "@/data/luthieryWorkbench";

interface LuthieryInstrumentPreviewProps {
  selection: LuthieryBuildSelection;
  shape: LuthieryShape;
  activePart: LuthieryPartSlot;
  onSelectPart: (part: LuthieryPartSlot) => void;
}

const NECK_COLOURS: Record<string, string> = {
  "neck-maple": "#c4935d",
  "neck-pine": "#d0a16b",
  "neck-alder": "#b9875e",
  "neck-mahogany": "#74452f",
  "neck-korina": "#a67849",
};

const FRETBOARD_COLOURS: Record<string, string> = {
  "fret-maple": "#c89a62",
  "fret-rosewood": "#56372b",
  "fret-ebony": "#211f23",
  "fret-brazilian": "#40251e",
};

const BODY_GRAIN: Record<string, string> = {
  "body-pine": "#d7b17a",
  "body-poplar": "#b8a578",
  "body-alder": "#9a6949",
  "body-ash": "#d4bd8d",
  "body-mahogany": "#5d3426",
  "body-korina": "#bc9156",
};

const activate = (
  event: KeyboardEvent<SVGGElement>,
  part: LuthieryPartSlot,
  onSelectPart: (part: LuthieryPartSlot) => void,
) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelectPart(part);
};

const PartGroup = ({
  part,
  activePart,
  onSelectPart,
  children,
}: {
  part: LuthieryPartSlot;
  activePart: LuthieryPartSlot;
  onSelectPart: (part: LuthieryPartSlot) => void;
  children: ReactNode;
}) => (
  <g
    role="button"
    tabIndex={0}
    aria-label={`Select ${part}`}
    aria-pressed={activePart === part}
    data-testid={`instrument-part-${part}`}
    onClick={() => onSelectPart(part)}
    onTouchEnd={() => onSelectPart(part)}
    onKeyDown={(event) => activate(event, part, onSelectPart)}
    className="cursor-pointer outline-none focus-visible:[filter:drop-shadow(0_0_5px_hsl(var(--primary)))]"
  >
    {children}
  </g>
);

const Decal = ({ selection }: { selection: LuthieryBuildSelection }) => {
  if (selection.finishId !== "finish-artwork" || selection.decal.id === "none") return null;

  const x = 57 + selection.decal.x * 0.72;
  const y = 88 + selection.decal.y * 0.68;
  const scale = Math.max(0.45, selection.decal.scale / 100);
  const transform = `translate(${x} ${y}) rotate(${selection.decal.rotation}) scale(${scale})`;
  const common = {
    fill: selection.decal.colour,
    stroke: selection.decal.colour,
    strokeWidth: 3,
  };

  return (
    <g transform={transform} pointerEvents="none" data-testid="instrument-decal" opacity="0.92">
      {selection.decal.id === "lightning" && (
        <path d="M-4 -19 L11 -4 L4 -3 L11 19 L-12 3 L-3 1 Z" {...common} />
      )}
      {selection.decal.id === "star" && (
        <polygon points="0,-19 5,-6 19,-6 8,2 12,17 0,8 -12,17 -8,2 -19,-6 -5,-6" {...common} />
      )}
      {selection.decal.id === "stripes" && (
        <g fill={selection.decal.colour}>
          <rect x="-18" y="-13" width="9" height="31" rx="2" transform="rotate(-18)" />
          <rect x="-4" y="-15" width="9" height="34" rx="2" transform="rotate(-18)" />
          <rect x="10" y="-13" width="9" height="31" rx="2" transform="rotate(-18)" />
        </g>
      )}
      {selection.decal.id === "target" && (
        <g fill="none" stroke={selection.decal.colour} strokeWidth="4">
          <circle cx="0" cy="0" r="18" />
          <circle cx="0" cy="0" r="10" />
          <circle cx="0" cy="0" r="2" fill={selection.decal.colour} />
        </g>
      )}
    </g>
  );
};

export const LuthieryInstrumentPreview = ({
  selection,
  shape,
  activePart,
  onSelectPart,
}: LuthieryInstrumentPreviewProps) => {
  const bass = selection.instrumentKind === "electric_bass";
  const neckLength = bass ? 244 : 211;
  const fretLength = neckLength - 8;
  const stringCount = bass ? 4 : 6;

  const bodyGrain = BODY_GRAIN[selection.parts.body] ?? "#9a6949";
  const neckFill = NECK_COLOURS[selection.parts.neck] ?? "#b9844d";
  const fretFill = FRETBOARD_COLOURS[selection.parts.fretboard] ?? "#422b22";

  const electronics = selection.parts.electronics;
  const singleCoil = electronics === "elec-single" || electronics === "elec-alnico";
  const active = electronics === "elec-active";
  const boutique = electronics === "elec-boutique";
  const pickupCount = singleCoil && !bass ? 3 : 2;
  const pickupWidth = singleCoil ? 8 : 15;
  const pickupFill = active ? "#111318" : boutique ? "#b58a3e" : singleCoil ? "#e7dfca" : "#3d4249";

  const hardware = selection.parts.hardware;
  const hardwareFill = hardware === "hw-gold" ? "#cfaa4b" : "#a7adb5";
  const bridgeWidth = hardware === "hw-floyd" ? 19 : hardware === "hw-trem" ? 16 : hardware === "hw-tom" ? 13 : 10;

  return (
    <svg
      viewBox="0 0 440 220"
      role="group"
      aria-label={`Interactive preview of ${shape.name} ${bass ? "bass" : "guitar"}`}
      className="mx-auto h-auto w-full max-w-[680px]"
      data-testid="luthiery-instrument-preview"
    >
      <defs>
        <linearGradient id="luthiery-finish" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={selection.colour} />
          <stop offset="62%" stopColor={selection.colour} stopOpacity={selection.finishId === "finish-metalflake" ? 0.74 : 0.94} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={selection.finishId === "finish-gloss" ? 0.22 : 0.06} />
        </linearGradient>
        <pattern id="luthiery-grain" width="15" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(9)">
          <path d="M0 3 C4 0 9 7 15 3 M0 8 C5 5 10 12 15 8" fill="none" stroke={bodyGrain} strokeOpacity="0.33" strokeWidth="1.2" />
        </pattern>
      </defs>

      <PartGroup part="body" activePart={activePart} onSelectPart={onSelectPart}>
        <path
          d={shape.bodyPath}
          transform="translate(12 38) scale(0.96)"
          fill="url(#luthiery-finish)"
          stroke={activePart === "body" ? "hsl(var(--primary))" : "hsl(var(--border))"}
          strokeWidth={activePart === "body" ? 4 : 2}
        />
        <path d={shape.bodyPath} transform="translate(12 38) scale(0.96)" fill="url(#luthiery-grain)" pointerEvents="none" />
        {selection.finishId === "finish-burst" && (
          <path
            d={shape.bodyPath}
            transform="translate(12 38) scale(0.96)"
            fill="none"
            stroke="#24170f"
            strokeOpacity="0.68"
            strokeWidth="11"
            pointerEvents="none"
          />
        )}
      </PartGroup>

      <PartGroup part="neck" activePart={activePart} onSelectPart={onSelectPart}>
        <rect
          x="124"
          y="100"
          width={neckLength}
          height="29"
          rx="4"
          fill={neckFill}
          stroke={activePart === "neck" ? "hsl(var(--primary))" : "hsl(var(--border))"}
          strokeWidth={activePart === "neck" ? 4 : 2}
        />
        <path
          d={`M${123 + neckLength} 97 L${157 + neckLength} 91 L${173 + neckLength} 102 L${167 + neckLength} 132 L${125 + neckLength} 132 Z`}
          fill={neckFill}
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
      </PartGroup>

      <PartGroup part="fretboard" activePart={activePart} onSelectPart={onSelectPart}>
        <rect
          x="131"
          y="104"
          width={fretLength}
          height="20"
          rx="2"
          fill={fretFill}
          stroke={activePart === "fretboard" ? "hsl(var(--primary))" : "#5e4438"}
          strokeWidth={activePart === "fretboard" ? 4 : 1}
        />
        {Array.from({ length: 13 }).map((_, index) => {
          const x = 145 + index * (fretLength / 14);
          return <line key={x} x1={x} y1="104" x2={x} y2="124" stroke="#c7b6a6" strokeOpacity="0.7" strokeWidth="1" />;
        })}
      </PartGroup>

      <PartGroup part="electronics" activePart={activePart} onSelectPart={onSelectPart}>
        {Array.from({ length: pickupCount }).map((_, index) => (
          <rect
            key={index}
            x={78 + index * 27}
            y="108"
            width={pickupWidth}
            height="25"
            rx={active ? 1 : 2}
            fill={pickupFill}
            stroke={activePart === "electronics" ? "hsl(var(--primary))" : "#6b7280"}
            strokeWidth={activePart === "electronics" ? 3 : 1.5}
          />
        ))}
      </PartGroup>

      <PartGroup part="hardware" activePart={activePart} onSelectPart={onSelectPart}>
        <rect
          x={121 - bridgeWidth}
          y="105"
          width={bridgeWidth}
          height="32"
          rx="2"
          fill={hardwareFill}
          stroke={activePart === "hardware" ? "hsl(var(--primary))" : "#555d68"}
          strokeWidth={activePart === "hardware" ? 3 : 1.5}
        />
        {(hardware === "hw-trem" || hardware === "hw-floyd") && (
          <path d="M112 133 L133 154" stroke={hardwareFill} strokeWidth="3" strokeLinecap="round" />
        )}
        <circle cx="70" cy="142" r="4" fill={hardwareFill} />
        <circle cx="92" cy="149" r="4" fill={hardwareFill} />
      </PartGroup>

      {Array.from({ length: stringCount }).map((_, index) => {
        const startY = 109 + (index * 18) / Math.max(1, stringCount - 1);
        return (
          <line
            key={index}
            x1="76"
            y1={startY}
            x2={292 + (bass ? 31 : 0)}
            y2={110 + (index * 10) / Math.max(1, stringCount - 1)}
            stroke="#d8d8d8"
            strokeOpacity="0.75"
            strokeWidth="0.9"
            pointerEvents="none"
          />
        );
      })}

      <Decal selection={selection} />
    </svg>
  );
};
