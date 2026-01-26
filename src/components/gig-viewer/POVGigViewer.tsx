import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { usePOVClipCycler, InstrumentRole } from '@/hooks/usePOVClipCycler';
import { POVPostProcessing } from './POVPostProcessing';
import { CameraShake } from './CameraShake';
import { POVOverlays } from './POVOverlays';
import { GuitaristPOV } from './pov-scenes/GuitaristPOV';
import { DrummerPOV } from './pov-scenes/DrummerPOV';
import { VocalistPOV } from './pov-scenes/VocalistPOV';
import { BassistPOV } from './pov-scenes/BassistPOV';
import { KeyboardistPOV } from './pov-scenes/KeyboardistPOV';

interface POVGigViewerProps {
  playerRole: InstrumentRole;
  intensity: number;
  songSection: string;
  crowdMood: number;
  isPlaying: boolean;
}

export const POVGigViewer = memo(({
  playerRole,
  intensity,
  songSection,
  crowdMood,
  isPlaying,
}: POVGigViewerProps) => {
  const {
    currentClip,
    activeOverlays,
  } = usePOVClipCycler({
    role: playerRole,
    songSection,
    intensity,
    isPlaying,
  });

  const clipType = currentClip?.clipType || 'playing';

  // Render the appropriate POV scene based on role
  const renderPOVScene = () => {
    switch (playerRole) {
      case 'guitarist':
        return (
          <GuitaristPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
          />
        );
      case 'drummer':
        return (
          <DrummerPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
          />
        );
      case 'vocalist':
        return (
          <VocalistPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
            crowdMood={crowdMood}
          />
        );
      case 'bassist':
        return (
          <BassistPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
          />
        );
      case 'keyboardist':
        return (
          <KeyboardistPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
          />
        );
      default:
        return (
          <VocalistPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
            crowdMood={crowdMood}
          />
        );
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Camera shake wrapper */}
      <CameraShake
        intensity={intensity}
        songSection={songSection}
        isPlaying={isPlaying}
      >
        {/* POV Scene */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {renderPOVScene()}
        </motion.div>
        
        {/* Dynamic overlays based on clip */}
        <POVOverlays
          activeOverlays={activeOverlays}
          intensity={intensity}
          songSection={songSection}
          crowdMood={crowdMood}
        />
      </CameraShake>
      
      {/* Post-processing effects (film grain, contrast, etc.) */}
      <POVPostProcessing
        intensity={intensity}
        grainAmount={0.18}
        contrast={1.3}
        saturation={0.7}
        enableScanLines={true}
        vignetteStrength={0.6}
      />
      
      {/* Clip info overlay (debug - can be removed in production) */}
      {currentClip && (
        <div className="absolute bottom-20 left-4 text-xs text-white/30 font-mono z-50 pointer-events-none">
          <div>{playerRole.toUpperCase()} POV</div>
          <div>{currentClip.clipType} • {currentClip.energyLevel}</div>
        </div>
      )}
    </div>
  );
});

POVGigViewer.displayName = 'POVGigViewer';
