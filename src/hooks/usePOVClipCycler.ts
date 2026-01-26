import { useState, useEffect, useCallback } from 'react';

export type InstrumentRole = 'guitarist' | 'bassist' | 'drummer' | 'vocalist' | 'keyboardist';
export type ClipType = 'playing' | 'crowd_look' | 'stage_scan' | 'solo_focus' | 'intro' | 'outro';
export type EnergyLevel = 'low' | 'medium' | 'high' | 'climax';

interface POVClip {
  id: string;
  instrumentRole: InstrumentRole;
  clipType: ClipType;
  description: string;
  energyLevel: EnergyLevel;
  overlays: string[];
  durationRange: [number, number];
}

// Built-in clip library based on database templates
const CLIP_LIBRARY: POVClip[] = [
  // Guitarist clips
  { id: 'g1', instrumentRole: 'guitarist', clipType: 'playing', description: 'Looking down at fretboard while playing', energyLevel: 'medium', overlays: ['stage_lights'], durationRange: [4, 7] },
  { id: 'g2', instrumentRole: 'guitarist', clipType: 'solo_focus', description: 'Intense focus on guitar solo', energyLevel: 'high', overlays: ['lens_flare', 'sweat_drops'], durationRange: [3, 5] },
  { id: 'g3', instrumentRole: 'guitarist', clipType: 'crowd_look', description: 'Glancing up at the crowd', energyLevel: 'medium', overlays: ['crowd_hands', 'stage_lights'], durationRange: [2, 4] },
  { id: 'g4', instrumentRole: 'guitarist', clipType: 'stage_scan', description: 'Scanning across the stage', energyLevel: 'low', overlays: ['haze'], durationRange: [3, 5] },
  
  // Bassist clips
  { id: 'b1', instrumentRole: 'bassist', clipType: 'playing', description: 'Looking down at bass neck', energyLevel: 'medium', overlays: ['stage_lights'], durationRange: [4, 8] },
  { id: 'b2', instrumentRole: 'bassist', clipType: 'crowd_look', description: 'Nodding to the rhythm while watching crowd', energyLevel: 'medium', overlays: ['crowd_hands'], durationRange: [3, 5] },
  { id: 'b3', instrumentRole: 'bassist', clipType: 'stage_scan', description: 'Looking at drummer for timing', energyLevel: 'low', overlays: ['haze'], durationRange: [2, 4] },
  
  // Drummer clips
  { id: 'd1', instrumentRole: 'drummer', clipType: 'playing', description: 'Sticks hitting snare and hi-hat', energyLevel: 'high', overlays: ['sweat_drops'], durationRange: [3, 6] },
  { id: 'd2', instrumentRole: 'drummer', clipType: 'crowd_look', description: 'Looking through cymbals at crowd', energyLevel: 'medium', overlays: ['crowd_hands', 'lens_flare'], durationRange: [2, 4] },
  { id: 'd3', instrumentRole: 'drummer', clipType: 'solo_focus', description: 'Intense drum fill moment', energyLevel: 'climax', overlays: ['lens_flare', 'sweat_drops', 'strobe'], durationRange: [2, 4] },
  
  // Vocalist clips
  { id: 'v1', instrumentRole: 'vocalist', clipType: 'playing', description: 'Holding microphone, facing crowd', energyLevel: 'medium', overlays: ['stage_lights', 'crowd_hands'], durationRange: [4, 7] },
  { id: 'v2', instrumentRole: 'vocalist', clipType: 'crowd_look', description: 'Reaching out to crowd', energyLevel: 'high', overlays: ['crowd_hands', 'lens_flare'], durationRange: [3, 5] },
  { id: 'v3', instrumentRole: 'vocalist', clipType: 'intro', description: 'Walking onto stage', energyLevel: 'low', overlays: ['haze', 'stage_lights'], durationRange: [4, 6] },
  { id: 'v4', instrumentRole: 'vocalist', clipType: 'outro', description: 'Final bow, crowd cheering', energyLevel: 'high', overlays: ['confetti', 'crowd_hands'], durationRange: [3, 5] },
  
  // Keyboardist clips
  { id: 'k1', instrumentRole: 'keyboardist', clipType: 'playing', description: 'Hands moving across keys', energyLevel: 'medium', overlays: ['stage_lights'], durationRange: [4, 7] },
  { id: 'k2', instrumentRole: 'keyboardist', clipType: 'crowd_look', description: 'Looking up from synth at audience', energyLevel: 'medium', overlays: ['crowd_hands'], durationRange: [2, 4] },
  { id: 'k3', instrumentRole: 'keyboardist', clipType: 'stage_scan', description: 'Watching other band members', energyLevel: 'low', overlays: ['haze'], durationRange: [3, 5] },
];

interface UsePOVClipCyclerProps {
  role: InstrumentRole;
  songSection: string;
  intensity: number;
  isPlaying: boolean;
}

export const usePOVClipCycler = ({ role, songSection, intensity, isPlaying }: UsePOVClipCyclerProps) => {
  const [currentClip, setCurrentClip] = useState<POVClip | null>(null);
  const [clipHistory, setClipHistory] = useState<string[]>([]);
  
  // Map song section to appropriate clip types
  const getClipTypesForSection = useCallback((section: string): ClipType[] => {
    switch (section) {
      case 'intro':
        return ['intro', 'stage_scan'];
      case 'verse':
        return ['playing', 'stage_scan'];
      case 'chorus':
        return ['playing', 'crowd_look'];
      case 'bridge':
        return ['stage_scan', 'playing'];
      case 'solo':
        return ['solo_focus', 'playing'];
      case 'outro':
        return ['outro', 'crowd_look'];
      default:
        return ['playing'];
    }
  }, []);
  
  // Map intensity to energy level
  const getEnergyFromIntensity = useCallback((intensity: number): EnergyLevel[] => {
    if (intensity < 0.3) return ['low', 'medium'];
    if (intensity < 0.6) return ['medium', 'high'];
    if (intensity < 0.85) return ['high', 'medium'];
    return ['climax', 'high'];
  }, []);
  
  // Select next clip
  const selectNextClip = useCallback(() => {
    const clipTypes = getClipTypesForSection(songSection);
    const energyLevels = getEnergyFromIntensity(intensity);
    
    // Filter clips for current role
    const roleClips = CLIP_LIBRARY.filter(clip => clip.instrumentRole === role);
    
    // Prefer clips matching current section and energy
    let candidates = roleClips.filter(
      clip => clipTypes.includes(clip.clipType) && energyLevels.includes(clip.energyLevel)
    );
    
    // Fallback to any clip for this role matching section
    if (candidates.length === 0) {
      candidates = roleClips.filter(clip => clipTypes.includes(clip.clipType));
    }
    
    // Fallback to any clip for this role
    if (candidates.length === 0) {
      candidates = roleClips;
    }
    
    // Avoid recent clips if possible
    const freshCandidates = candidates.filter(clip => !clipHistory.includes(clip.id));
    const finalCandidates = freshCandidates.length > 0 ? freshCandidates : candidates;
    
    // Pick random clip
    const selectedClip = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    
    if (selectedClip) {
      setCurrentClip(selectedClip);
      setClipHistory(prev => [...prev.slice(-5), selectedClip.id]);
    }
  }, [role, songSection, intensity, clipHistory, getClipTypesForSection, getEnergyFromIntensity]);
  
  // Initial clip selection
  useEffect(() => {
    if (!currentClip) {
      selectNextClip();
    }
  }, [currentClip, selectNextClip]);
  
  // Cycle clips based on duration
  useEffect(() => {
    if (!isPlaying || !currentClip) return;
    
    const [minDuration, maxDuration] = currentClip.durationRange;
    const duration = (minDuration + Math.random() * (maxDuration - minDuration)) * 1000;
    
    const timeout = setTimeout(() => {
      selectNextClip();
    }, duration);
    
    return () => clearTimeout(timeout);
  }, [isPlaying, currentClip, selectNextClip]);
  
  // Change clip on song section change
  useEffect(() => {
    if (isPlaying) {
      selectNextClip();
    }
  }, [songSection]); // Intentionally not including selectNextClip to prevent infinite loops
  
  return {
    currentClip,
    activeOverlays: currentClip?.overlays || [],
    clipDescription: currentClip?.description || '',
    forceNextClip: selectNextClip,
  };
};
