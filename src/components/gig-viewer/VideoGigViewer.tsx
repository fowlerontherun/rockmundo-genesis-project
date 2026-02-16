import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, Play, Pause, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { GigAudioPlayer } from './GigAudioPlayer';
import { VideoClipPlayer } from './VideoClipPlayer';
import { VideoGigHUD } from './VideoGigHUD';
import { usePOVClips } from '@/hooks/usePOVClips';
import { useGigClipSequence } from '@/hooks/useGigClipSequence';
import { useCrowdSounds } from '@/hooks/useCrowdSounds';
import type { Database } from '@/lib/supabase-types';

interface VideoGigViewerProps {
  gigId: string;
  onClose: () => void;
}

type GigOutcome = Database['public']['Tables']['gig_outcomes']['Row'];
type SongPerformance = Database['public']['Tables']['gig_song_performances']['Row'] & {
  song_audio_url?: string | null;
  song_title?: string | null;
};

export const VideoGigViewer = ({ gigId, onClose }: VideoGigViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHudMinimized, setIsHudMinimized] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [crowdMood, setCrowdMood] = useState(50);
  const [gigOutcome, setGigOutcome] = useState<GigOutcome | null>(null);
  const [songPerformances, setSongPerformances] = useState<SongPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [instrumentRoles, setInstrumentRoles] = useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [venueName, setVenueName] = useState('Unknown Venue');
  const [venueCapacity, setVenueCapacity] = useState(200);
  const hasPlayedEntranceRef = useRef(false);
  const lastSongIndexRef = useRef(-1);

  // Determine venue size for clip selection
  const venueSize = venueCapacity < 300 ? 'small' : venueCapacity < 2000 ? 'medium' : venueCapacity < 5000 ? 'arena' : 'festival';

  // Fetch POV clips
  const { data: clipData } = usePOVClips(instrumentRoles, venueSize);

  // Crowd sounds
  const {
    isLoaded: crowdSoundsLoaded,
    setVolume: setCrowdVolume,
    setMuted: setCrowdMuted,
    playEntrance,
    playApplause,
    playCrowdReaction,
  } = useCrowdSounds();

  // Clip sequence
  const intensity = crowdMood / 100;
  const {
    currentClip,
    currentPhase,
    forceNext,
  } = useGigClipSequence({
    instrumentClips: clipData?.instrumentClips || [],
    universalClips: clipData?.universalClips || [],
    isPlaying: isAudioPlaying,
    intensity,
    songIndex: currentSongIndex,
    totalSongs: songPerformances.length,
  });

  // Fetch gig data
  useEffect(() => {
    const fetchGigData = async () => {
      try {
        const { data: outcome, error: outcomeError } = await supabase
          .from('gig_outcomes')
          .select('*, gig_song_performances(*)')
          .eq('gig_id', gigId)
          .single();

        if (outcomeError) throw outcomeError;

        setGigOutcome(outcome);
        const performances = (outcome.gig_song_performances || []) as SongPerformance[];
        const sortedPerformances = performances.sort((a, b) => (a.position || 0) - (b.position || 0));

        // Fetch audio URLs and song titles
        const songIds = sortedPerformances.map(p => p.song_id).filter(Boolean);
        if (songIds.length > 0) {
          const { data: songsData } = await supabase
            .from('songs')
            .select('id, audio_url, title')
            .in('id', songIds);

          const songMap = new Map(songsData?.map(s => [s.id, s]) || []);
          sortedPerformances.forEach(p => {
            if (p.song_id) {
              const song = songMap.get(p.song_id);
              p.song_audio_url = song?.audio_url || null;
              p.song_title = song?.title || null;
            }
          });
        }

        setSongPerformances(sortedPerformances);

        if (performances.length > 0) {
          setCrowdMood(Math.min(100, Math.max(0, (performances[0].performance_score / 25) * 100)));
        }

        // Fetch gig details
        const { data: gigData } = await supabase
          .from('gigs')
          .select('band_id, venues!gigs_venue_id_fkey(name, capacity)')
          .eq('id', gigId)
          .single();

        if (gigData) {
          const venue = gigData.venues as any;
          if (venue) {
            setVenueName(venue.name || 'Unknown Venue');
            setVenueCapacity(venue.capacity || 200);
          }

          // Fetch band members' instrument roles
          if (gigData.band_id) {
            const { data: members } = await supabase
              .from('band_members')
              .select('instrument_role')
              .eq('band_id', gigData.band_id)
              .not('user_id', 'is', null);

            if (members) {
              setInstrumentRoles(members.map(m => m.instrument_role));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching gig data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGigData();
  }, [gigId]);

  // Crowd sounds sync
  useEffect(() => {
    setCrowdVolume(volume);
    setCrowdMuted(isMuted);
  }, [volume, isMuted, setCrowdVolume, setCrowdMuted]);

  // Play entrance sound
  useEffect(() => {
    if (crowdSoundsLoaded && !hasPlayedEntranceRef.current && !isLoading) {
      playEntrance();
      hasPlayedEntranceRef.current = true;
    }
  }, [crowdSoundsLoaded, isLoading, playEntrance]);

  // Play crowd reaction on song change
  useEffect(() => {
    if (!crowdSoundsLoaded || songPerformances.length === 0) return;
    if (lastSongIndexRef.current !== currentSongIndex && lastSongIndexRef.current !== -1) {
      const currentSong = songPerformances[currentSongIndex];
      if (currentSong?.crowd_response) {
        playCrowdReaction(currentSong.crowd_response);
      }
    }
    lastSongIndexRef.current = currentSongIndex;
  }, [currentSongIndex, crowdSoundsLoaded, songPerformances, playCrowdReaction]);

  // Auto-advance songs
  useEffect(() => {
    if (songPerformances.length === 0 || !isAudioPlaying) return;
    const interval = setInterval(() => {
      setCurrentSongIndex(prev => {
        const next = (prev + 1) % songPerformances.length;
        const song = songPerformances[next];
        if (song) {
          setCrowdMood(Math.min(100, Math.max(0, (song.performance_score / 25) * 100)));
        }
        if (next === 0 && prev === songPerformances.length - 1 && crowdSoundsLoaded) {
          playApplause();
        }
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [songPerformances, isAudioPlaying, crowdSoundsLoaded, playApplause]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const currentSong = songPerformances[currentSongIndex];
  const attendancePercentage = gigOutcome?.attendance_percentage || 70;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-lg font-semibold">Loading Stage...</div>
        </div>
      </div>
    );
  }

  // Fallback: no clips available yet - show audio-only mode
  const hasClips = clipData?.hasClips;

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Video clip player */}
      {hasClips ? (
        <VideoClipPlayer
          videoUrl={currentClip?.video_url || null}
          thumbnailUrl={currentClip?.thumbnail_url}
          isPlaying={isAudioPlaying}
        />
      ) : (
        // Audio-only fallback with visualizer-like background
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Equalizer bars */}
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 bg-primary rounded-t"
                  animate={{
                    height: isAudioPlaying ? [
                      Math.random() * 60 + 10,
                      Math.random() * 100 + 20,
                      Math.random() * 40 + 10,
                    ] : 10,
                  }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.5,
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                />
              ))}
            </div>
            <p className="text-white/50 text-sm">POV clips generating — audio only mode</p>
          </motion.div>

          {/* Film grain */}
          <div 
            className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-10"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.4\'/%3E%3C/svg%3E")',
              backgroundSize: '128px 128px',
            }}
          />
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)' }}
          />
        </div>
      )}

      {/* Audio Player */}
      {currentSong?.song_audio_url && (
        <GigAudioPlayer
          audioUrl={currentSong.song_audio_url}
          isPlaying={isAudioPlaying}
          onEnded={() => {
            if (currentSongIndex < songPerformances.length - 1) {
              setCurrentSongIndex(prev => prev + 1);
            }
          }}
          volume={isMuted ? 0 : volume}
          hideControls={true}
        />
      )}

      {/* HUD Overlay */}
      <VideoGigHUD
        venueName={venueName}
        currentSongTitle={currentSong?.song_title || undefined}
        currentSongIndex={currentSongIndex}
        totalSongs={songPerformances.length}
        crowdMood={crowdMood}
        attendancePercentage={attendancePercentage}
        crowdResponse={currentSong?.crowd_response || undefined}
        phase={currentPhase}
        isMinimized={isHudMinimized}
        onToggleMinimize={() => setIsHudMinimized(prev => !prev)}
      />

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-4 right-4 z-40 flex items-center justify-between">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
            onClick={() => setIsAudioPlaying(prev => !prev)}
          >
            {isAudioPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:bg-white/20 rounded-full"
            onClick={() => {
              if (currentSongIndex < songPerformances.length - 1) {
                setCurrentSongIndex(prev => prev + 1);
              }
              forceNext();
            }}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:bg-white/20 rounded-full"
            onClick={() => setIsMuted(prev => !prev)}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={([val]) => {
              setVolume(val / 100);
              if (val > 0) setIsMuted(false);
            }}
            max={100}
            step={1}
            className="w-20"
          />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:bg-white/20 rounded-full"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:bg-white/20 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
