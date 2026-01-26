import { useState, memo, useMemo } from 'react';
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
import { CrowdPOV } from './pov-scenes/CrowdPOV';
import { StageLightsOverlay } from './pov-scenes/StageLightsOverlay';
import type { ClipVariantId } from './pov-scenes/clipVariants';

interface POVGigViewerProps {
  playerRole: InstrumentRole;
  intensity: number;
  songSection: string;
  crowdMood: number;
  isPlaying: boolean;
  venueCapacity?: number;
  guitarSkin?: 'default' | 'red' | 'black' | 'sunburst' | 'white';
  showCrowdLayer?: boolean;
}

export const POVGigViewer = memo(({
  playerRole,
  intensity,
  songSection,
  crowdMood,
  isPlaying,
  venueCapacity = 500,
  guitarSkin = 'default',
  showCrowdLayer = true,
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
  
  // Determine which clip variant to use based on role and context
  const clipVariant = useMemo((): ClipVariantId | undefined => {
    switch (playerRole) {
      case 'guitarist':
        // G2 for solos, G1 for regular playing
        return songSection === 'solo' || clipType === 'solo_focus' ? 'G2' : 'G1';
      case 'bassist':
        return 'B1';
      case 'drummer':
        // D2 for fills/solos (toms view), D1 for regular (snare view)
        return songSection === 'solo' || clipType === 'solo_focus' ? 'D2' : 'D1';
      case 'vocalist':
        return 'V1';
      default:
        return undefined;
    }
  }, [playerRole, songSection, clipType]);
  
  // Determine crowd variant based on venue size
  const crowdVariant: 'C1' | 'C2' = venueCapacity < 500 ? 'C1' : 'C2';
  const venueSize: 'small' | 'medium' | 'large' = venueCapacity < 300 ? 'small' : venueCapacity < 1000 ? 'medium' : 'large';

  // Render the appropriate POV scene based on role
  const renderPOVScene = () => {
    switch (playerRole) {
      case 'guitarist':
        return (
          <GuitaristPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
            clipVariant={clipVariant as 'G1' | 'G2' | 'H1'}
            guitarSkin={guitarSkin}
          />
        );
      case 'drummer':
        return (
          <DrummerPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
            clipVariant={clipVariant as 'D1' | 'D2'}
          />
        );
      case 'vocalist':
        return (
          <VocalistPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
            crowdMood={crowdMood}
            clipVariant="V1"
          />
        );
      case 'bassist':
        return (
          <BassistPOV
            intensity={intensity}
            songSection={songSection}
            clipType={clipType}
            clipVariant="B1"
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
            clipVariant="V1"
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
        {/* Crowd layer (background - C1 or C2) */}
        {showCrowdLayer && playerRole !== 'vocalist' && (
          <div className="absolute inset-0 opacity-40">
            <CrowdPOV
              intensity={intensity}
              crowdMood={crowdMood}
              venueSize={venueSize}
              clipVariant={crowdVariant}
            />
          </div>
        )}
        
        {/* POV Scene */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {renderPOVScene()}
        </motion.div>
        
        {/* Stage Lights Overlay (L1) - always active */}
        <StageLightsOverlay intensity={intensity} variant="L1" />
        
        {/* Camera Shake Overlay (L2) - at high intensity */}
        {intensity > 0.5 && (
          <StageLightsOverlay intensity={intensity} variant="L2" />
        )}
        
        {/* Dynamic overlays based on clip */}
        <POVOverlays
          activeOverlays={activeOverlays}
          intensity={intensity}
          songSection={songSection}
          crowdMood={crowdMood}
        />
      </CameraShake>
      
      {/* Post-processing effects (film grain, contrast, etc.) - MTV2/Kerrang aesthetic */}
      <POVPostProcessing
        intensity={intensity}
        grainAmount={0.2}
        contrast={1.35}
        saturation={0.65}
        enableScanLines={true}
        vignetteStrength={0.65}
      />
      
      {/* Clip variant info overlay (debug) */}
      {currentClip && (
        <div className="absolute bottom-20 left-4 text-xs text-white/30 font-mono z-50 pointer-events-none">
          <div>{playerRole.toUpperCase()} POV • {clipVariant || 'default'}</div>
          <div>{currentClip.clipType} • {currentClip.energyLevel}</div>
          <div>Crowd: {crowdVariant} ({venueSize})</div>
        </div>
      )}
    </div>
  );
});

POVGigViewer.displayName = 'POVGigViewer';
