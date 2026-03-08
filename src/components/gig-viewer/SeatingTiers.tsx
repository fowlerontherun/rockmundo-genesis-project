import { motion } from "framer-motion";
import { useMemo } from "react";

interface SeatingTiersProps {
  venueType: string | null;
  attendancePercent: number;
  mood: string;
  intensity: number;
}

export const SeatingTiers = ({ venueType, attendancePercent, mood, intensity }: SeatingTiersProps) => {
  const hasSeating = venueType === 'arena' || venueType === 'stadium' || venueType === 'concert_hall';
  const tierCount = venueType === 'stadium' ? 3 : venueType === 'arena' ? 2 : 1;

  // Generate seated attendees per tier
  const tiers = useMemo(() => {
    if (!hasSeating) return [];
    return Array.from({ length: tierCount }).map((tier, tierIdx) => {
      const fillRate = Math.max(0.3, (attendancePercent / 100) - (tierIdx * 0.15));
      const seatsPerRow = venueType === 'stadium' ? 20 : venueType === 'arena' ? 16 : 12;
      const rows = venueType === 'stadium' ? 3 : 2;
      const seats: { x: number; y: number; filled: boolean; delay: number }[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < seatsPerRow; col++) {
          seats.push({
            x: (col / (seatsPerRow - 1)) * 100,
            y: (row / Math.max(rows - 1, 1)) * 100,
            filled: Math.random() < fillRate,
            delay: Math.random() * 2,
          });
        }
      }
      return { seats, tierIdx };
    });
  }, [tierCount, attendancePercent, venueType]);

  const isActive = mood === 'ecstatic' || mood === 'enthusiastic';

  return (
    <div className="absolute inset-0 pointer-events-none z-[0]">
      {/* Side seating tiers */}
      {tiers.map(({ seats, tierIdx }) => {
        const yOffset = 60 + tierIdx * 14; // Push lower tiers further back
        const opacity = 1 - tierIdx * 0.2;

        return (
          <div key={`tier-${tierIdx}`}>
            {/* Left tier */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: '0%',
                width: '8%',
                top: `${10 + tierIdx * 5}%`,
                bottom: `${25 - tierIdx * 5}%`,
                opacity,
              }}
            >
              {/* Tier background */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, hsl(0, 0%, ${6 + tierIdx * 2}%) 0%, hsl(0, 0%, ${4 + tierIdx}%) 100%)`,
                  borderRight: '1px solid hsl(0, 0%, 15%)',
                }}
              />
              {/* Seated people dots */}
              <div className="absolute inset-[10%] flex flex-wrap gap-[1px] content-start">
                {seats.slice(0, Math.floor(seats.length / 2)).map((seat, i) =>
                  seat.filled ? (
                    <motion.div
                      key={`l-${tierIdx}-${i}`}
                      className="w-1 h-1 rounded-full bg-zinc-500/40"
                      animate={isActive ? { y: [0, -1, 0] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity, delay: seat.delay }}
                    />
                  ) : (
                    <div key={`l-${tierIdx}-${i}`} className="w-1 h-1" />
                  )
                )}
              </div>
            </div>

            {/* Right tier */}
            <div
              className="absolute overflow-hidden"
              style={{
                right: '0%',
                width: '8%',
                top: `${10 + tierIdx * 5}%`,
                bottom: `${25 - tierIdx * 5}%`,
                opacity,
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(270deg, hsl(0, 0%, ${6 + tierIdx * 2}%) 0%, hsl(0, 0%, ${4 + tierIdx}%) 100%)`,
                  borderLeft: '1px solid hsl(0, 0%, 15%)',
                }}
              />
              <div className="absolute inset-[10%] flex flex-wrap gap-[1px] content-start justify-end">
                {seats.slice(Math.floor(seats.length / 2)).map((seat, i) =>
                  seat.filled ? (
                    <motion.div
                      key={`r-${tierIdx}-${i}`}
                      className="w-1 h-1 rounded-full bg-zinc-500/40"
                      animate={isActive ? { y: [0, -1, 0] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity, delay: seat.delay }}
                    />
                  ) : (
                    <div key={`r-${tierIdx}-${i}`} className="w-1 h-1" />
                  )
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Upper rear seating for stadium */}
      {venueType === 'stadium' && (
        <div
          className="absolute bottom-0 left-[10%] right-[10%] overflow-hidden"
          style={{ height: '12%' }}
        >
          <div className="absolute inset-0 bg-zinc-950 border-t border-zinc-800/30" />
          <div className="absolute inset-[5%] flex flex-wrap gap-[2px] content-start justify-center">
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={`rear-${i}`}
                className="w-1 h-1 rounded-full"
                style={{
                  backgroundColor: Math.random() < (attendancePercent / 100) * 0.8
                    ? 'hsl(0, 0%, 35%)'
                    : 'transparent',
                }}
                animate={isActive && Math.random() > 0.5 ? { y: [0, -0.5, 0] } : {}}
                transition={{ duration: 1, repeat: Infinity, delay: Math.random() * 2 }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
