import { useState, useEffect, useCallback, useRef } from 'react';
import type { POVClip } from './usePOVClips';

interface ClipSequenceItem {
  clip: POVClip;
  duration: number; // seconds
  phase: 'backstage' | 'entrance' | 'performance' | 'between_songs' | 'exit';
}

interface UseGigClipSequenceProps {
  instrumentClips: POVClip[];
  universalClips: POVClip[];
  isPlaying: boolean;
  intensity: number; // 0-1
  songIndex: number;
  totalSongs: number;
}

export const useGigClipSequence = ({
  instrumentClips,
  universalClips,
  isPlaying,
  intensity,
  songIndex,
  totalSongs,
}: UseGigClipSequenceProps) => {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [sequence, setSequence] = useState<ClipSequenceItem[]>([]);
  const [phase, setPhase] = useState<string>('backstage');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevSongIndexRef = useRef(songIndex);

  // Build clip sequence when clips change
  useEffect(() => {
    if (instrumentClips.length === 0 && universalClips.length === 0) return;

    const newSequence: ClipSequenceItem[] = [];
    const pickRandom = (clips: POVClip[]) => clips[Math.floor(Math.random() * clips.length)];

    // Phase 1: Backstage walk
    const backstageClips = universalClips.filter(c => c.clip_type === 'backstage' || c.variant?.includes('corridor') || c.variant?.includes('tunnel') || c.variant?.includes('green_room'));
    if (backstageClips.length > 0) {
      newSequence.push({ clip: pickRandom(backstageClips), duration: 4, phase: 'backstage' });
    }

    // Phase 2: Entrance
    const entranceClips = universalClips.filter(c => c.clip_type === 'entrance' || c.variant?.includes('entrance') || c.variant?.includes('spotlight'));
    if (entranceClips.length > 0) {
      newSequence.push({ clip: pickRandom(entranceClips), duration: 4, phase: 'entrance' });
    }

    // Phase 3: Performance cycle - interleave instrument and crowd clips
    const crowdClips = universalClips.filter(c => c.clip_type === 'crowd' || c.variant?.includes('crowd') || c.variant?.includes('mosh') || c.variant?.includes('phone'));
    const betweenClips = universalClips.filter(c => c.clip_type === 'between_songs' || c.variant?.includes('bandmate') || c.variant?.includes('gear'));
    
    // Generate performance clips for each song (cycle through instruments)
    for (let s = 0; s < Math.max(totalSongs, 3); s++) {
      // 2-3 instrument clips per song
      const clipsPerSong = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < clipsPerSong; i++) {
        if (instrumentClips.length > 0) {
          const clip = instrumentClips[(s * clipsPerSong + i) % instrumentClips.length];
          newSequence.push({ clip, duration: 4 + Math.random() * 3, phase: 'performance' });
        }
        // Crowd cut after every 2nd instrument clip
        if (i % 2 === 1 && crowdClips.length > 0) {
          newSequence.push({ clip: pickRandom(crowdClips), duration: 3, phase: 'performance' });
        }
      }

      // Between songs clip
      if (s < totalSongs - 1 && betweenClips.length > 0) {
        newSequence.push({ clip: pickRandom(betweenClips), duration: 3, phase: 'between_songs' });
      }
    }

    // Phase 4: Exit
    const exitClips = universalClips.filter(c => c.clip_type === 'exit' || c.variant?.includes('bow') || c.variant?.includes('wave') || c.variant?.includes('encore'));
    if (exitClips.length > 0) {
      newSequence.push({ clip: pickRandom(exitClips), duration: 5, phase: 'exit' });
    }

    setSequence(newSequence);
    setCurrentClipIndex(0);
  }, [instrumentClips, universalClips, totalSongs]);

  // Auto-advance clips
  useEffect(() => {
    if (!isPlaying || sequence.length === 0) return;

    const currentItem = sequence[currentClipIndex];
    if (!currentItem) return;

    // Adjust duration based on intensity
    const adjustedDuration = currentItem.duration * (intensity > 0.7 ? 0.7 : intensity > 0.4 ? 0.85 : 1);

    timerRef.current = setTimeout(() => {
      setCurrentClipIndex(prev => {
        const next = prev + 1;
        // Loop back to performance section (skip backstage/entrance on replay)
        if (next >= sequence.length) {
          const firstPerformance = sequence.findIndex(s => s.phase === 'performance');
          return firstPerformance >= 0 ? firstPerformance : 0;
        }
        return next;
      });
    }, adjustedDuration * 1000);

    setPhase(currentItem.phase);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentClipIndex, sequence, intensity]);

  // Jump ahead when song changes
  useEffect(() => {
    if (songIndex !== prevSongIndexRef.current && sequence.length > 0) {
      prevSongIndexRef.current = songIndex;
      // Find a between_songs clip or next performance clip
      const betweenIdx = sequence.findIndex((s, i) => i > currentClipIndex && s.phase === 'between_songs');
      if (betweenIdx >= 0) {
        setCurrentClipIndex(betweenIdx);
      }
    }
  }, [songIndex, sequence, currentClipIndex]);

  const currentClip = sequence[currentClipIndex]?.clip || null;
  const currentPhase = sequence[currentClipIndex]?.phase || 'performance';

  const forceNext = useCallback(() => {
    setCurrentClipIndex(prev => (prev + 1) % Math.max(sequence.length, 1));
  }, [sequence.length]);

  return {
    currentClip,
    currentPhase,
    clipIndex: currentClipIndex,
    totalClips: sequence.length,
    forceNext,
  };
};
