import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type OverlayType = 
  | 'lens_flare'
  | 'stage_lights'
  | 'sweat_drops'
  | 'crowd_hands'
  | 'pyro_flash'
  | 'strobe'
  | 'haze'
  | 'confetti';

interface POVOverlaysProps {
  activeOverlays: string[];
  intensity: number;
  songSection: string;
  crowdMood: number;
}

// Individual overlay components
const LensFlare = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: intensity * 0.3 }}
    exit={{ opacity: 0 }}
  >
    {/* Main flare */}
    <motion.div
      className="absolute"
      style={{
        width: 150 + intensity * 100,
        height: 150 + intensity * 100,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,200,0.4) 0%, rgba(255,200,100,0.1) 40%, transparent 70%)',
        filter: 'blur(2px)',
      }}
      animate={{
        top: ['15%', '20%', '15%'],
        left: ['60%', '65%', '60%'],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
    {/* Secondary flare */}
    <motion.div
      className="absolute"
      style={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(100,200,255,0.3) 0%, transparent 70%)',
        filter: 'blur(4px)',
      }}
      animate={{
        top: ['70%', '65%', '70%'],
        left: ['30%', '35%', '30%'],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  </motion.div>
));
LensFlare.displayName = 'LensFlare';

const StageLights = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.4 }}
    exit={{ opacity: 0 }}
  >
    {/* Colored light beams */}
    {[
      { color: 'rgba(255,50,50,0.2)', angle: -30, x: '10%' },
      { color: 'rgba(50,50,255,0.2)', angle: 30, x: '90%' },
      { color: 'rgba(255,200,50,0.15)', angle: 0, x: '50%' },
    ].map((beam, i) => (
      <motion.div
        key={i}
        className="absolute top-0 w-32 h-[120%]"
        style={{
          left: beam.x,
          background: `linear-gradient(to bottom, ${beam.color}, transparent 80%)`,
          transformOrigin: 'top center',
        }}
        animate={{
          rotate: [beam.angle - 5, beam.angle + 5, beam.angle - 5],
          opacity: [0.3 + intensity * 0.2, 0.5 + intensity * 0.3, 0.3 + intensity * 0.2],
        }}
        transition={{
          duration: 2 + i * 0.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </motion.div>
));
StageLights.displayName = 'StageLights';

const SweatDrops = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none overflow-hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: intensity * 0.5 }}
    exit={{ opacity: 0 }}
  >
    {/* Simulated sweat/moisture on lens */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at 30% 70%, rgba(255,255,255,0.03) 0%, transparent 30%), radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.02) 0%, transparent 25%)',
      }}
    />
    {/* Droplet effects */}
    {intensity > 0.6 && (
      <motion.div
        className="absolute w-1 h-4 bg-white/10 rounded-full"
        style={{ top: '60%', left: '80%' }}
        animate={{ y: [0, 50], opacity: [0.3, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      />
    )}
  </motion.div>
));
SweatDrops.displayName = 'SweatDrops';

const CrowdHands = memo(({ crowdMood }: { crowdMood: number }) => (
  <motion.div
    className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: crowdMood > 50 ? 0.7 : 0.3, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
  >
    {/* Silhouette hands reaching up */}
    <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end">
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="relative"
          animate={{
            y: crowdMood > 60 ? [0, -10, 0] : [0, -5, 0],
            rotate: [(i % 2) * 10 - 5, (i % 2) * -10 + 5, (i % 2) * 10 - 5],
          }}
          transition={{
            duration: 0.5 + Math.random() * 0.3,
            repeat: Infinity,
            delay: Math.random() * 0.5,
          }}
        >
          {/* Arm/hand silhouette */}
          <div
            className="bg-black/80 rounded-t-full"
            style={{
              width: 8 + Math.random() * 4,
              height: 40 + Math.random() * 20,
            }}
          />
        </motion.div>
      ))}
    </div>
  </motion.div>
));
CrowdHands.displayName = 'CrowdHands';

const PyroFlash = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{
      opacity: [0, 1, 0.5, 0],
      background: ['transparent', 'rgba(255,200,50,0.4)', 'rgba(255,100,0,0.2)', 'transparent'],
    }}
    transition={{
      duration: 0.5,
      repeat: Infinity,
      repeatDelay: 5 + Math.random() * 10,
    }}
  >
    {/* Pyro sparks */}
    <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-orange-400 rounded-full blur-sm" />
    <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-yellow-300 rounded-full blur-sm" />
  </motion.div>
));
PyroFlash.displayName = 'PyroFlash';

const Strobe = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none bg-white"
    initial={{ opacity: 0 }}
    animate={{
      opacity: [0, intensity * 0.4, 0],
    }}
    transition={{
      duration: 0.1,
      repeat: Infinity,
      repeatDelay: 0.2 / intensity,
    }}
  />
));
Strobe.displayName = 'Strobe';

const Haze = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.4 }}
    exit={{ opacity: 0 }}
  >
    {/* Fog/haze layers */}
    <motion.div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(to top, rgba(100,100,120,0.3) 0%, rgba(100,100,120,0.1) 40%, transparent 80%)',
      }}
      animate={{
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
    {/* Drifting haze wisps */}
    <motion.div
      className="absolute w-full h-1/2 bottom-0"
      style={{
        background: 'radial-gradient(ellipse at 30% 80%, rgba(150,150,170,0.15) 0%, transparent 50%)',
      }}
      animate={{
        x: [-50, 50, -50],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  </motion.div>
));
Haze.displayName = 'Haze';

const Confetti = memo(() => (
  <motion.div
    className="absolute inset-0 pointer-events-none overflow-hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {Array.from({ length: 30 }).map((_, i) => {
      const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181'];
      return (
        <motion.div
          key={i}
          className="absolute w-2 h-3 rounded-sm"
          style={{
            background: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: '-10%',
          }}
          animate={{
            y: ['0vh', '120vh'],
            x: [0, (Math.random() - 0.5) * 100],
            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: 'linear',
          }}
        />
      );
    })}
  </motion.div>
));
Confetti.displayName = 'Confetti';

export const POVOverlays = memo(({ activeOverlays, intensity, songSection, crowdMood }: POVOverlaysProps) => {
  // Determine which overlays to show based on active list and context
  const overlaysToRender = useMemo(() => {
    const overlays: { type: OverlayType; show: boolean }[] = [
      { type: 'lens_flare', show: activeOverlays.includes('lens_flare') },
      { type: 'stage_lights', show: activeOverlays.includes('stage_lights') },
      { type: 'sweat_drops', show: activeOverlays.includes('sweat_drops') && intensity > 0.5 },
      { type: 'crowd_hands', show: activeOverlays.includes('crowd_hands') && crowdMood > 40 },
      { type: 'pyro_flash', show: activeOverlays.includes('pyro_flash') && (songSection === 'chorus' || songSection === 'outro') },
      { type: 'strobe', show: activeOverlays.includes('strobe') && intensity > 0.7 },
      { type: 'haze', show: activeOverlays.includes('haze') },
      { type: 'confetti', show: activeOverlays.includes('confetti') && songSection === 'outro' },
    ];
    return overlays.filter(o => o.show);
  }, [activeOverlays, intensity, songSection, crowdMood]);

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      <AnimatePresence>
        {overlaysToRender.map(({ type }) => {
          switch (type) {
            case 'lens_flare':
              return <LensFlare key="lens_flare" intensity={intensity} />;
            case 'stage_lights':
              return <StageLights key="stage_lights" intensity={intensity} />;
            case 'sweat_drops':
              return <SweatDrops key="sweat_drops" intensity={intensity} />;
            case 'crowd_hands':
              return <CrowdHands key="crowd_hands" crowdMood={crowdMood} />;
            case 'pyro_flash':
              return <PyroFlash key="pyro_flash" intensity={intensity} />;
            case 'strobe':
              return <Strobe key="strobe" intensity={intensity} />;
            case 'haze':
              return <Haze key="haze" intensity={intensity} />;
            case 'confetti':
              return <Confetti key="confetti" />;
            default:
              return null;
          }
        })}
      </AnimatePresence>
    </div>
  );
});

POVOverlays.displayName = 'POVOverlays';
