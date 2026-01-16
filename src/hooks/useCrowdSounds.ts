import { useEffect, useState, useCallback } from "react";
import { getCrowdSoundMixer, CrowdSoundMixer } from "@/utils/crowdSoundMixer";

interface UseCrowdSoundsResult {
  mixer: CrowdSoundMixer;
  isLoaded: boolean;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  playEntrance: () => void;
  playExit: () => void;
  playEncore: () => void;
  playApplause: () => void;
  playCrowdReaction: (response: string) => void;
  stopAll: () => void;
}

export function useCrowdSounds(): UseCrowdSoundsResult {
  const [mixer] = useState(() => getCrowdSoundMixer());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      await mixer.loadSounds();
      setIsLoaded(mixer.hasSounds());
    };
    
    if (!mixer.hasSounds()) {
      load();
    } else {
      setIsLoaded(true);
    }
    
    return () => {
      // Don't stop sounds on unmount - let them finish naturally
    };
  }, [mixer]);

  const setVolume = useCallback((volume: number) => {
    mixer.setVolume(volume);
  }, [mixer]);

  const setMuted = useCallback((muted: boolean) => {
    mixer.setMuted(muted);
  }, [mixer]);

  const playEntrance = useCallback(() => {
    mixer.playGigMoment('entrance');
  }, [mixer]);

  const playExit = useCallback(() => {
    mixer.playGigMoment('exit');
  }, [mixer]);

  const playEncore = useCallback(() => {
    mixer.playGigMoment('encore');
  }, [mixer]);

  const playApplause = useCallback(() => {
    mixer.playGigMoment('applause');
  }, [mixer]);

  const playCrowdReaction = useCallback((response: string) => {
    mixer.playCrowdReaction(response);
  }, [mixer]);

  const stopAll = useCallback(() => {
    mixer.stopAll();
  }, [mixer]);

  return {
    mixer,
    isLoaded,
    setVolume,
    setMuted,
    playEntrance,
    playExit,
    playEncore,
    playApplause,
    playCrowdReaction,
    stopAll,
  };
}
