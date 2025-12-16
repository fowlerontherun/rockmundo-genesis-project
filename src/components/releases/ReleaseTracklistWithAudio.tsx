import { Badge } from "@/components/ui/badge";
import { SongPlayer } from "@/components/audio/SongPlayer";

interface Track {
  song: {
    id: string;
    title: string;
    genre?: string;
    quality_score?: number;
    audio_url?: string | null;
    audio_generation_status?: string | null;
    duration_seconds?: number;
  };
  is_b_side?: boolean;
}

interface ReleaseTracklistWithAudioProps {
  tracks: Track[];
  showAudio?: boolean;
}

export function ReleaseTracklistWithAudio({ tracks, showAudio = true }: ReleaseTracklistWithAudioProps) {
  if (!tracks || tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tracks added</p>
    );
  }

  return (
    <div className="space-y-2">
      {tracks.map((track, index) => (
        <div 
          key={`${track.song?.id || index}-${index}`} 
          className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
        >
          <span className="text-muted-foreground text-sm w-6">
            {index + 1}.
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{track.song?.title || "Unknown"}</span>
              {track.is_b_side && (
                <Badge variant="outline" className="text-xs">B-side</Badge>
              )}
              {track.song?.quality_score && (
                <Badge variant="secondary" className="text-xs">
                  Q: {track.song.quality_score}
                </Badge>
              )}
            </div>
            {track.song?.genre && (
              <span className="text-xs text-muted-foreground">{track.song.genre}</span>
            )}
          </div>
          
          {showAudio && track.song?.audio_url && (
            <div className="flex-shrink-0">
              <SongPlayer
                audioUrl={track.song.audio_url}
                generationStatus={track.song.audio_generation_status || "completed"}
                title={track.song.title}
                compact
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
