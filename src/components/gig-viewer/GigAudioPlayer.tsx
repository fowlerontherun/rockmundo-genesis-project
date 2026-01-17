import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface GigAudioPlayerProps {
  audioUrl: string | null;
  isPlaying: boolean;
  onEnded?: () => void;
  volume?: number; // External volume control (0-1)
  hideControls?: boolean; // Hide built-in volume controls
}

export const GigAudioPlayer = ({ audioUrl, isPlaying, onEnded, volume: externalVolume, hideControls = false }: GigAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [internalVolume, setInternalVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  
  // Use external volume if provided, otherwise use internal state
  const effectiveVolume = externalVolume !== undefined ? externalVolume : internalVolume;

  useEffect(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.volume = effectiveVolume;
      audioRef.current.onended = () => onEnded?.();
    } else if (audioRef.current.src !== audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }

    if (isPlaying) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [audioUrl, isPlaying, onEnded]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : effectiveVolume;
    }
  }, [effectiveVolume, isMuted]);

  if (!audioUrl) return null;
  
  // If hideControls is true or external volume is provided, don't show the built-in controls
  if (hideControls || externalVolume !== undefined) {
    return null; // Audio plays but no UI rendered
  }

  if (!audioUrl) return null;

  return (
    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/20"
        onClick={() => setIsMuted(!isMuted)}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
      <Slider
        value={[isMuted ? 0 : internalVolume * 100]}
        onValueChange={([val]) => {
          setInternalVolume(val / 100);
          if (val > 0) setIsMuted(false);
        }}
        max={100}
        step={1}
        className="w-24"
      />
    </div>
  );
};
