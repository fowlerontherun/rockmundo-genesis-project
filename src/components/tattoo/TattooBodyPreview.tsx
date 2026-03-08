import { Badge } from "@/components/ui/badge";
import { 
  BODY_SLOTS, 
  LEFT_SLEEVE_SLOTS, 
  RIGHT_SLEEVE_SLOTS, 
  getSleeveProgress, 
  type BodySlot, 
  type PlayerTattoo 
} from "@/data/tattooDesigns";

interface TattooBodyPreviewProps {
  tattoos: PlayerTattoo[];
  onSlotClick?: (slot: BodySlot) => void;
  selectedSlot?: BodySlot | null;
}

// SVG positions for each body slot (relative to a 200x400 viewbox)
const SLOT_POSITIONS: Record<BodySlot, { x: number; y: number; w: number; h: number }> = {
  left_shoulder: { x: 42, y: 68, w: 22, h: 22 },
  left_upper_arm: { x: 30, y: 92, w: 20, h: 36 },
  left_inner_arm: { x: 34, y: 96, w: 16, h: 28 },
  left_forearm: { x: 22, y: 130, w: 18, h: 36 },
  left_wrist: { x: 16, y: 168, w: 14, h: 16 },
  right_shoulder: { x: 136, y: 68, w: 22, h: 22 },
  right_upper_arm: { x: 150, y: 92, w: 20, h: 36 },
  right_inner_arm: { x: 150, y: 96, w: 16, h: 28 },
  right_forearm: { x: 160, y: 130, w: 18, h: 36 },
  right_wrist: { x: 170, y: 168, w: 14, h: 16 },
  neck: { x: 88, y: 52, w: 24, h: 16 },
  chest: { x: 72, y: 82, w: 56, h: 40 },
  back: { x: 76, y: 86, w: 48, h: 44 },
};

function getSlotColor(slot: BodySlot, tattoos: PlayerTattoo[]): string {
  const tattoo = tattoos.find(t => t.body_slot === slot);
  if (!tattoo) return 'hsl(var(--muted))';
  if (tattoo.is_infected) return 'hsl(0 80% 50%)';
  if (tattoo.quality_score >= 80) return 'hsl(142 70% 45%)';
  if (tattoo.quality_score >= 50) return 'hsl(48 90% 50%)';
  return 'hsl(25 80% 50%)';
}

export const TattooBodyPreview = ({ tattoos, onSlotClick, selectedSlot }: TattooBodyPreviewProps) => {
  const leftProgress = getSleeveProgress(tattoos, 'left');
  const rightProgress = getSleeveProgress(tattoos, 'right');

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 200 300" className="w-full max-w-[240px] h-auto">
        {/* Body outline */}
        <ellipse cx="100" cy="36" rx="22" ry="28" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Torso */}
        <path d="M64 68 Q60 70 58 90 L52 130 Q50 140 54 145 L70 160 Q80 165 100 168 Q120 165 130 160 L146 145 Q150 140 148 130 L142 90 Q140 70 136 68 Z" 
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Left arm */}
        <path d="M58 72 Q40 80 30 100 L18 150 Q12 170 16 180 L24 180 Q28 172 32 160 L48 110 Q52 90 58 80 Z"
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Right arm */}
        <path d="M142 72 Q160 80 170 100 L182 150 Q188 170 184 180 L176 180 Q172 172 168 160 L152 110 Q148 90 142 80 Z"
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Legs */}
        <path d="M70 160 Q72 200 74 240 L78 290 L92 290 L90 240 Q92 200 100 168"
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <path d="M130 160 Q128 200 126 240 L122 290 L108 290 L110 240 Q108 200 100 168"
          fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />

        {/* Tattoo slot hitboxes */}
        {(Object.entries(SLOT_POSITIONS) as [BodySlot, typeof SLOT_POSITIONS[BodySlot]][]).map(([slot, pos]) => {
          const hasTattoo = tattoos.some(t => t.body_slot === slot);
          const isSelected = selectedSlot === slot;
          const color = getSlotColor(slot, tattoos);

          return (
            <g key={slot} onClick={() => onSlotClick?.(slot)} className="cursor-pointer">
              <rect
                x={pos.x} y={pos.y} width={pos.w} height={pos.h}
                rx={3}
                fill={hasTattoo ? color : 'transparent'}
                stroke={isSelected ? 'hsl(var(--primary))' : hasTattoo ? color : 'hsl(var(--border))'}
                strokeWidth={isSelected ? 2.5 : 1}
                strokeDasharray={hasTattoo ? undefined : '3 2'}
                opacity={hasTattoo ? 0.7 : 0.4}
              />
              {hasTattoo && (
                <text x={pos.x + pos.w / 2} y={pos.y + pos.h / 2 + 3} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
                  {tattoos.find(t => t.body_slot === slot)?.custom_text ? 'Aa' : '✓'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Sleeve progress */}
      <div className="flex gap-4 text-xs">
        <div className="text-center">
          <Badge variant={leftProgress.isComplete ? 'default' : 'outline'} className="text-[10px]">
            L Arm: {leftProgress.filled}/{leftProgress.total}
          </Badge>
          {leftProgress.isComplete && <div className="text-green-400 mt-1">✨ Full Sleeve!</div>}
        </div>
        <div className="text-center">
          <Badge variant={rightProgress.isComplete ? 'default' : 'outline'} className="text-[10px]">
            R Arm: {rightProgress.filled}/{rightProgress.total}
          </Badge>
          {rightProgress.isComplete && <div className="text-green-400 mt-1">✨ Full Sleeve!</div>}
        </div>
      </div>
    </div>
  );
};
