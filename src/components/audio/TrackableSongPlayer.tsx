import { useEffect, useRef } from "react";
import { SongPlayer } from "./SongPlayer";
import { useTrackSongPlay } from "@/hooks/useTrackSongPlay";

interface TrackableSongPlayerProps {
  songId: string;
  audioUrl: string | null;
  title?: string;
  artist?: string;
  generationStatus?: string | null;
  compact?: boolean;
  showShare?: boolean;
  source?: string;
}

export function TrackableSongPlayer({
  songId,
  audioUrl,
  title,
  artist,
  generationStatus,
  compact = false,
  showShare = true,
  source = "app",
}: TrackableSongPlayerProps) {
  const { trackPlay } = useTrackSongPlay();
  const hasTrackedRef = useRef(false);

  // Track play when audio starts - only once per mount
  const handlePlay = () => {
    if (!hasTrackedRef.current && songId) {
      trackPlay(songId, source);
      hasTrackedRef.current = true;
    }
  };

  // Reset tracking when songId changes
  useEffect(() => {
    hasTrackedRef.current = false;
  }, [songId]);

  if (!audioUrl) return null;

  return (
    <SongPlayer
      audioUrl={audioUrl}
      title={title}
      artist={artist}
      generationStatus={generationStatus}
      compact={compact}
      showShare={showShare}
      onPlay={handlePlay}
    />
  );
}
