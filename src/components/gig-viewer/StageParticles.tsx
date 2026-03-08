import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GenreVisualConfig } from "./GenreVisuals";

interface StageParticlesProps {
  genreVisuals: GenreVisualConfig | null;
  songEnergy: 'high' | 'medium' | 'low';
  intensity: number;
  lightingColor: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

export const StageParticles = ({ genreVisuals, songEnergy, intensity, lightingColor }: StageParticlesProps) => {
  const particleStyle = genreVisuals?.particleStyle || 'none';
  if (particleStyle === 'none' || songEnergy === 'low') return null;

  const particles = useMemo(() => {
    const count = songEnergy === 'high' ? 20 : 10;
    const result: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const size = particleStyle === 'confetti'
        ? 3 + Math.random() * 4
        : particleStyle === 'sparks'
          ? 1 + Math.random() * 2
          : 4 + Math.random() * 6; // smoke

      const color = particleStyle === 'confetti'
        ? [`hsl(0,80%,60%)`, `hsl(60,80%,60%)`, `hsl(120,80%,50%)`, `hsl(200,80%,60%)`, `hsl(280,80%,60%)`, `hsl(320,80%,60%)`][i % 6]
        : particleStyle === 'sparks'
          ? `hsl(${30 + Math.random() * 30}, 100%, ${60 + Math.random() * 30}%)`
          : `rgba(200,200,200,${0.1 + Math.random() * 0.15})`;

      result.push({
        id: i, x, y, size,
        delay: Math.random() * 3,
        duration: particleStyle === 'smoke' ? 4 + Math.random() * 3 : 1.5 + Math.random() * 2,
        color,
      });
    }
    return result;
  }, [particleStyle, songEnergy]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[7] overflow-hidden">
      {particleStyle === 'confetti' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 1,
          }}
          initial={{ top: '-5%', rotate: 0, opacity: 1 }}
          animate={{
            top: '110%',
            rotate: [0, 180, 360, 540],
            x: [0, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30],
            opacity: [1, 1, 0.6],
          }}
          transition={{
            duration: p.duration + 1,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeIn',
          }}
        />
      ))}

      {particleStyle === 'sparks' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${40 + Math.random() * 30}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          animate={{
            y: [0, -(20 + Math.random() * 40)],
            x: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40],
            opacity: [1, 0],
            scale: [1, 0.3],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}

      {particleStyle === 'smoke' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: '0%',
            width: p.size * 4,
            height: p.size * 4,
            backgroundColor: p.color,
            filter: `blur(${p.size}px)`,
          }}
          animate={{
            y: [0, -(40 + Math.random() * 60)],
            x: [(Math.random() - 0.5) * 30],
            opacity: [0.3, 0],
            scale: [0.5, 2],
          }}
          transition={{
            duration: p.duration + 2,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};
