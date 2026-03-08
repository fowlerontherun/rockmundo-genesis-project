import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { StageThemeConfig } from './StageThemes';

interface StageDecorProps {
  theme: StageThemeConfig;
  lightingColor: string;
  songEnergy: 'high' | 'medium' | 'low';
  intensity: number;
  bandName?: string;
}

// Map equipment scale to numeric values
const EQUIPMENT_SCALE_MAP: Record<string, number> = {
  minimal: 0.4,
  standard: 0.7,
  large: 1.0,
  massive: 1.5,
};

/**
 * StageDecor - Additional decorative elements for the stage
 * Includes banners, logos, backdrop details, and stage edge lighting
 */
export const StageDecor = ({ 
  theme, 
  lightingColor, 
  songEnergy, 
  intensity,
  bandName 
}: StageDecorProps) => {
  const equipmentScale = EQUIPMENT_SCALE_MAP[theme.equipmentScale] || 0.7;

  // Truss system for large venues
  const trussBars = useMemo(() => {
    if (equipmentScale < 0.8) return [];
    const count = equipmentScale >= 1.5 ? 4 : equipmentScale >= 1 ? 3 : 2;
    return Array.from({ length: count }, (_, i) => ({
      id: `truss-${i}`,
      top: 5 + i * (equipmentScale >= 1.5 ? 8 : 10),
    }));
  }, [equipmentScale]);

  // Stage edge LED strips
  const ledStripColors = useMemo(() => {
    const hue = parseInt(lightingColor.match(/\d+/)?.[0] || '0');
    return Array.from({ length: 12 }, (_, i) => ({
      id: `led-${i}`,
      hue: (hue + i * 30) % 360,
      delay: i * 0.1,
    }));
  }, [lightingColor]);

  // Backdrop banner/logo area
  const showBackdropBanner = equipmentScale >= 0.6;
  const showSideSpeakerStacks = equipmentScale >= 0.8;
  const showCabinets = equipmentScale >= 1;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Overhead truss system */}
      {trussBars.map(truss => (
        <div
          key={truss.id}
          className="absolute left-[10%] right-[10%] h-1 bg-muted"
          style={{
            top: `${truss.top}%`,
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--muted)) 10%, hsl(var(--muted)) 90%, transparent 100%)',
          }}
        >
          {/* Truss segments */}
          <div className="absolute inset-0 flex justify-between">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="w-px h-full bg-muted-foreground/30"
              />
            ))}
          </div>
          {/* Par cans on truss */}
          <div className="absolute -bottom-2 inset-x-0 flex justify-around">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: `hsl(${(parseInt(lightingColor.match(/\d+/)?.[0] || '0') + i * 40) % 360}, 80%, 50%)`,
                  boxShadow: `0 4px 12px hsl(${(parseInt(lightingColor.match(/\d+/)?.[0] || '0') + i * 40) % 360}, 80%, 50%)`,
                }}
                animate={{
                  opacity: songEnergy === 'high' ? [0.8, 1, 0.8] : 0.6,
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Backdrop banner area */}
      {showBackdropBanner && (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2">
          {/* Band logo/name backdrop */}
          <div 
            className="px-6 py-2 rounded border border-border/50 backdrop-blur-sm bg-background/20"
            style={{
              fontSize: equipmentScale >= 1 ? '1rem' : '0.75rem',
            }}
          >
            {bandName && (
              <motion.span
                className="font-bold tracking-wider text-foreground/80 uppercase"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {bandName}
              </motion.span>
            )}
          </div>
        </div>
      )}

      {/* Side speaker stacks for larger venues */}
      {showSideSpeakerStacks && (
        <>
          {/* Left stack */}
          <div className="absolute left-[3%] top-[25%] flex flex-col gap-1">
            {Array.from({ length: Math.ceil(equipmentScale * 2) }).map((_, i) => (
              <div
                key={`left-${i}`}
                className="w-6 h-4 bg-card border border-border rounded-sm"
                style={{ transform: `scale(${1 - i * 0.05})` }}
              >
                <div className="w-full h-full grid grid-cols-3 gap-px p-px opacity-60">
                  <div className="bg-muted rounded-full" />
                  <div className="bg-muted rounded-full" />
                  <div className="bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Right stack */}
          <div className="absolute right-[3%] top-[25%] flex flex-col gap-1">
            {Array.from({ length: Math.ceil(equipmentScale * 2) }).map((_, i) => (
              <div
                key={`right-${i}`}
                className="w-6 h-4 bg-card border border-border rounded-sm"
                style={{ transform: `scale(${1 - i * 0.05})` }}
              >
                <div className="w-full h-full grid grid-cols-3 gap-px p-px opacity-60">
                  <div className="bg-muted rounded-full" />
                  <div className="bg-muted rounded-full" />
                  <div className="bg-muted rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Stage front LED strip */}
      <div className="absolute bottom-0 left-[5%] right-[5%] h-1 flex">
        {ledStripColors.map(led => (
          <motion.div
            key={led.id}
            className="flex-1 h-full"
            style={{
              background: `hsl(${led.hue}, 80%, 50%)`,
            }}
            animate={{
              opacity: songEnergy === 'high' ? [0.6, 1, 0.6] : [0.4, 0.6, 0.4],
            }}
            transition={{
              duration: songEnergy === 'high' ? 0.3 : 1,
              repeat: Infinity,
              delay: led.delay,
            }}
          />
        ))}
      </div>

      {/* Side curtain shadows for indoor venues */}
      {theme.curtainStyle !== 'open' && theme.curtainStyle !== 'none' && (
        <>
          <div 
            className="absolute top-0 left-0 bottom-0 w-[8%] pointer-events-none bg-gradient-to-r from-background/40 to-transparent"
          />
          <div 
            className="absolute top-0 right-0 bottom-0 w-[8%] pointer-events-none bg-gradient-to-l from-background/40 to-transparent"
          />
        </>
      )}

      {/* Amp/cabinet stacks behind band (for rock/metal) */}
      {showCabinets && (
        <div className="absolute top-[30%] left-[15%] right-[15%] flex justify-around">
          {Array.from({ length: Math.ceil(equipmentScale * 2) }).map((_, i) => (
            <div 
              key={`cab-${i}`}
              className="w-8 h-6 bg-card border border-border rounded-sm relative"
            >
              {/* Marshall-style grille */}
              <div className="absolute inset-1 bg-muted rounded-sm" 
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 3px)'
                }}
              />
              {/* Top head unit */}
              <div className="absolute -top-2 left-0.5 right-0.5 h-2 bg-card border border-border rounded-t-sm">
                <div className="absolute top-0.5 left-1 right-1 flex gap-0.5">
                  {[1,2,3,4].map(k => (
                    <div key={k} className="w-1 h-1 rounded-full bg-muted" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stage floor tape marks */}
      <div className="absolute bottom-[15%] left-[20%] right-[20%] flex justify-around opacity-30">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={`tape-${i}`}
            className="w-4 h-4 border-2 border-dashed border-warning/50 rounded-full"
          />
        ))}
      </div>

      {/* Cable runs on stage floor */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <path
          d="M 10% 90% Q 30% 80% 50% 85% T 90% 90%"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground"
        />
        <path
          d="M 15% 85% Q 40% 75% 60% 80% T 85% 88%"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted"
        />
      </svg>
    </div>
  );
};
