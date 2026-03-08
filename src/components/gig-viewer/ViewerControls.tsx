import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gauge, ZoomIn, ZoomOut, BarChart3, Eye, EyeOff } from "lucide-react";

interface ViewerControlsProps {
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  cameraZoom: 'full' | 'stage';
  onCameraChange: (zoom: 'full' | 'stage') => void;
  showStats: boolean;
  onStatsToggle: (show: boolean) => void;
}

const SPEEDS = [1, 2, 4];

export const ViewerControls = ({
  playbackSpeed,
  onSpeedChange,
  cameraZoom,
  onCameraChange,
  showStats,
  onStatsToggle,
}: ViewerControlsProps) => {
  return (
    <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1">
      {/* Speed control */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-black/70 hover:bg-black/90 text-white border border-zinc-700/50"
        onClick={() => {
          const idx = SPEEDS.indexOf(playbackSpeed);
          onSpeedChange(SPEEDS[(idx + 1) % SPEEDS.length]);
        }}
        title={`Speed: ${playbackSpeed}x`}
      >
        <span className="text-[9px] font-bold">{playbackSpeed}x</span>
      </Button>

      {/* Camera zoom toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-black/70 hover:bg-black/90 text-white border border-zinc-700/50"
        onClick={() => onCameraChange(cameraZoom === 'full' ? 'stage' : 'full')}
        title={cameraZoom === 'full' ? 'Zoom to stage' : 'Full venue view'}
      >
        {cameraZoom === 'full' ? <ZoomIn className="h-3 w-3" /> : <ZoomOut className="h-3 w-3" />}
      </Button>

      {/* Stats overlay toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-black/70 hover:bg-black/90 text-white border border-zinc-700/50"
        onClick={() => onStatsToggle(!showStats)}
        title={showStats ? 'Hide stats' : 'Show stats'}
      >
        {showStats ? <EyeOff className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
      </Button>
    </div>
  );
};
