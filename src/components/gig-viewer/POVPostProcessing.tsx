import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface POVPostProcessingProps {
  intensity: number;
  grainAmount?: number;
  contrast?: number;
  saturation?: number;
  enableScanLines?: boolean;
  vignetteStrength?: number;
}

export const POVPostProcessing = memo(({
  intensity,
  grainAmount = 0.18,
  contrast = 1.3,
  saturation = 0.7,
  enableScanLines = true,
  vignetteStrength = 0.6,
}: POVPostProcessingProps) => {
  // Adjust effects based on intensity
  const adjustedValues = useMemo(() => ({
    grain: grainAmount + (intensity * 0.08), // More grain at high intensity
    contrast: contrast + (intensity * 0.15), // Higher contrast during intense moments
    saturation: saturation - (intensity * 0.1), // More desaturated at high intensity (gritty feel)
    vignette: vignetteStrength + (intensity * 0.15),
  }), [intensity, grainAmount, contrast, saturation, vignetteStrength]);

  return (
    <>
      {/* Main filter container - applies to entire view */}
      <div 
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          filter: `contrast(${adjustedValues.contrast}) saturate(${adjustedValues.saturation}) brightness(${1.05 + intensity * 0.1})`,
          mixBlendMode: 'normal',
        }}
      />
      
      {/* Film grain overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-51"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 0.1,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          opacity: adjustedValues.grain,
          mixBlendMode: 'overlay',
        }}
      />
      
      {/* Overexposed highlights bloom */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-52"
        animate={{
          opacity: [0.03, 0.08, 0.03],
        }}
        transition={{
          duration: 2 + Math.random(),
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          mixBlendMode: 'overlay',
        }}
      />
      
      {/* Scan lines (CRT effect) */}
      {enableScanLines && (
        <div
          className="absolute inset-0 pointer-events-none z-53"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
            opacity: 0.5,
          }}
        />
      )}
      
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-54"
        style={{
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${adjustedValues.vignette}) 100%)`,
        }}
      />
      
      {/* Color aberration on edges */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-55"
        animate={{
          opacity: intensity > 0.7 ? [0, 0.03, 0] : 0,
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
        }}
        style={{
          boxShadow: 'inset -2px 0 10px rgba(255,0,0,0.1), inset 2px 0 10px rgba(0,255,255,0.1)',
        }}
      />
      
      {/* Flash/strobe effect on high intensity */}
      {intensity > 0.85 && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-56"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15, 0],
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
            repeatDelay: 0.5 + Math.random() * 1.5,
          }}
          style={{
            background: 'white',
          }}
        />
      )}
    </>
  );
});

POVPostProcessing.displayName = 'POVPostProcessing';
