import { memo } from 'react';
import { motion } from 'framer-motion';

interface StageLightsOverlayProps {
  intensity: number;
  variant: 'L1' | 'L2';
}

// L1 - Stage Lights Overlay
// Dynamic stage lights flashing in sync with energetic rock music
const DynamicStageLights = memo(({ intensity }: { intensity: number }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {/* Main spotlight - overexposed center */}
    <motion.div
      className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-64"
      animate={{
        opacity: [0.3 + intensity * 0.3, 0.6 + intensity * 0.3, 0.3 + intensity * 0.3],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 0.8, repeat: Infinity }}
      style={{
        background: 'radial-gradient(ellipse at center top, rgba(255,255,255,0.9) 0%, rgba(255,220,150,0.4) 40%, transparent 70%)',
        filter: 'blur(15px)',
      }}
    />
    
    {/* Sweeping colored beams */}
    <motion.div
      className="absolute top-0 left-0 w-32 h-full"
      animate={{
        left: ['0%', '70%', '0%'],
        opacity: [0.2, 0.5, 0.2],
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        background: 'linear-gradient(to bottom, rgba(255,50,50,0.4) 0%, transparent 80%)',
        filter: 'blur(20px)',
        transformOrigin: 'top center',
      }}
    />
    <motion.div
      className="absolute top-0 right-0 w-32 h-full"
      animate={{
        right: ['0%', '70%', '0%'],
        opacity: [0.2, 0.5, 0.2],
      }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      style={{
        background: 'linear-gradient(to bottom, rgba(50,50,255,0.4) 0%, transparent 80%)',
        filter: 'blur(20px)',
        transformOrigin: 'top center',
      }}
    />
    
    {/* Strobe flashes at high intensity */}
    {intensity > 0.7 && (
      <motion.div
        className="absolute inset-0 bg-white"
        animate={{ opacity: [0, 0.15, 0] }}
        transition={{ duration: 0.08, repeat: Infinity, repeatDelay: 0.4 / intensity }}
      />
    )}
    
    {/* Side par cans */}
    <motion.div
      className="absolute top-1/4 left-4 w-20 h-40"
      animate={{
        opacity: [0.2, 0.5, 0.2],
        rotate: [-5, 5, -5],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      style={{
        background: 'radial-gradient(ellipse at top left, rgba(255,100,100,0.5) 0%, transparent 60%)',
        filter: 'blur(10px)',
        transformOrigin: 'top left',
      }}
    />
    <motion.div
      className="absolute top-1/4 right-4 w-20 h-40"
      animate={{
        opacity: [0.2, 0.5, 0.2],
        rotate: [5, -5, 5],
      }}
      transition={{ duration: 2.2, repeat: Infinity, delay: 0.5 }}
      style={{
        background: 'radial-gradient(ellipse at top right, rgba(100,100,255,0.5) 0%, transparent 60%)',
        filter: 'blur(10px)',
        transformOrigin: 'top right',
      }}
    />
    
    {/* Lens flare artifacts */}
    <motion.div
      className="absolute"
      animate={{
        top: ['20%', '25%', '20%'],
        left: ['55%', '60%', '55%'],
        opacity: [0.2, 0.5, 0.2],
        scale: [1, 1.2, 1],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      style={{
        width: 40,
        height: 40,
        background: 'radial-gradient(circle, rgba(255,255,200,0.6) 0%, transparent 70%)',
        filter: 'blur(4px)',
      }}
    />
    <motion.div
      className="absolute"
      animate={{
        top: ['70%', '65%', '70%'],
        left: ['30%', '35%', '30%'],
        opacity: [0.15, 0.35, 0.15],
      }}
      transition={{ duration: 3, repeat: Infinity, delay: 1 }}
      style={{
        width: 25,
        height: 25,
        background: 'radial-gradient(circle, rgba(150,200,255,0.5) 0%, transparent 70%)',
        filter: 'blur(3px)',
      }}
    />
    
    {/* Film grain effect */}
    <div
      className="absolute inset-0 opacity-20 mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  </div>
));
DynamicStageLights.displayName = 'DynamicStageLights';

// L2 - Camera Shake Overlay
// Cinematic handheld camera shake effect
const CameraShakeEffect = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    animate={{
      x: [0, (Math.random() - 0.5) * 4 * intensity, (Math.random() - 0.5) * 3 * intensity, 0],
      y: [0, (Math.random() - 0.5) * 3 * intensity, (Math.random() - 0.5) * 4 * intensity, 0],
      rotate: [0, (Math.random() - 0.5) * 0.5 * intensity, (Math.random() - 0.5) * 0.3 * intensity, 0],
    }}
    transition={{
      duration: 0.15,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  >
    {/* Subtle motion blur effect at edges */}
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(to right, 
          rgba(0,0,0,${0.1 * intensity}) 0%, 
          transparent 5%, 
          transparent 95%, 
          rgba(0,0,0,${0.1 * intensity}) 100%
        )`,
      }}
    />
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(to bottom, 
          rgba(0,0,0,${0.1 * intensity}) 0%, 
          transparent 5%, 
          transparent 95%, 
          rgba(0,0,0,${0.1 * intensity}) 100%
        )`,
      }}
    />
    
    {/* Rolling shutter simulation - subtle */}
    {intensity > 0.6 && (
      <motion.div
        className="absolute inset-0"
        animate={{
          skewX: [0, 0.2, -0.2, 0],
        }}
        transition={{ duration: 0.2, repeat: Infinity }}
        style={{
          transformOrigin: 'center center',
        }}
      />
    )}
  </motion.div>
));
CameraShakeEffect.displayName = 'CameraShakeEffect';

export const StageLightsOverlay = memo(({ intensity, variant }: StageLightsOverlayProps) => {
  if (variant === 'L1') {
    return <DynamicStageLights intensity={intensity} />;
  }
  return <CameraShakeEffect intensity={intensity} />;
});

StageLightsOverlay.displayName = 'StageLightsOverlay';
