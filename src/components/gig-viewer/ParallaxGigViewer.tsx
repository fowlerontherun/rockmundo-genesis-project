import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { X, Maximize2, Minimize2, Music, Users, Volume2, VolumeX, Play, Pause, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GigAudioPlayer } from "./GigAudioPlayer";
import { RpmAvatarImage } from "./RpmAvatarImage";
import { SimpleStageBackground } from "./SimpleStageBackground";
import { StageSpotlights } from "./StageSpotlights";
import { Stage3DEquipment } from "./Stage3DEquipment";
import { useCrowdSounds } from "@/hooks/useCrowdSounds";
import type { Database } from "@/lib/supabase-types";
interface ParallaxGigViewerProps {
  gigId: string;
  onClose: () => void;
}

type GigOutcome = Database['public']['Tables']['gig_outcomes']['Row'];
type SongPerformance = Database['public']['Tables']['gig_song_performances']['Row'] & {
  song_audio_url?: string | null;
};

interface BandMember {
  role: string;
  avatarUrl: string | null;
  instrumentRole: string;
}

interface VenueInfo {
  name: string;
  venueType: string;
  capacity: number;
}

type StageTheme = 'indoor_night' | 'indoor_day' | 'outdoor_festival' | 'club' | 'arena' | 'theater';

export const ParallaxGigViewer = ({ gigId, onClose }: ParallaxGigViewerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHudMinimized, setIsHudMinimized] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [crowdMood, setCrowdMood] = useState(50);
  const [gigOutcome, setGigOutcome] = useState<GigOutcome | null>(null);
  const [songPerformances, setSongPerformances] = useState<SongPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [songSection, setSongSection] = useState<'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro'>('intro');
  const [isAudioPlaying, setIsAudioPlaying] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [venueInfo, setVenueInfo] = useState<VenueInfo | null>(null);
  const [stageTheme, setStageTheme] = useState<StageTheme>('indoor_night');
  const [isNightShow, setIsNightShow] = useState(true);
  const hasPlayedEntranceRef = useRef(false);
  const lastSongIndexRef = useRef(-1);
  
  // Crowd sounds
  const { 
    isLoaded: crowdSoundsLoaded, 
    setVolume: setCrowdVolume, 
    setMuted: setCrowdMuted,
    playEntrance, 
    playApplause, 
    playCrowdReaction 
  } = useCrowdSounds();
  
  // Sync volume with crowd sounds
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setCrowdVolume(newVolume);
  };
  
  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setCrowdMuted(newMuted);
  };

  // Helper to determine stage theme from venue type and time
  const determineStageTheme = (venueType: string, timeSlot: string | null, scheduledDate: string | null): StageTheme => {
    // Check if outdoor venue (stadium, festival-like)
    if (venueType === 'stadium' || venueType === 'arena') {
      // Check time - if before 6pm, it's a day festival
      if (scheduledDate) {
        const hour = new Date(scheduledDate).getHours();
        if (hour < 18) {
          setIsNightShow(false);
          return 'outdoor_festival';
        }
      }
      setIsNightShow(true);
      return 'arena';
    }
    
    if (venueType === 'club') {
      setIsNightShow(true);
      return 'club';
    }
    
    if (venueType === 'theater' || venueType === 'concert_hall') {
      setIsNightShow(true);
      return 'theater';
    }
    
    // Default indoor venues
    if (timeSlot === 'kids' || timeSlot === 'opening') {
      setIsNightShow(false);
      return 'indoor_day';
    }
    
    setIsNightShow(true);
    return 'indoor_night';
  };

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
        
        // Fetch audio URLs for each song
        const songIds = sortedPerformances.map(p => p.song_id).filter(Boolean);
        if (songIds.length > 0) {
          const { data: songsWithAudio } = await supabase
            .from('songs')
            .select('id, audio_url')
            .in('id', songIds);
          
          const audioMap = new Map(songsWithAudio?.map(s => [s.id, s.audio_url]) || []);
          sortedPerformances.forEach(p => {
            if (p.song_id) {
              p.song_audio_url = audioMap.get(p.song_id) || null;
            }
          });
        }
        
        setSongPerformances(sortedPerformances);
        
        // Set initial crowd mood
        if (performances.length > 0) {
          const firstSongMood = Math.min(100, Math.max(0, (performances[0].performance_score / 25) * 100));
          setCrowdMood(firstSongMood);
        } else {
          const initialMood = Math.min(100, Math.max(0, (outcome.overall_rating / 25) * 100));
          setCrowdMood(initialMood);
        }

        // Fetch gig details including venue info
        const { data: gigData } = await supabase
          .from('gigs')
          .select('band_id, time_slot, scheduled_date, venues!gigs_venue_id_fkey(name, venue_type, capacity)')
          .eq('id', gigId)
          .single();

        if (gigData) {
          // Set venue info and stage theme
          const venue = gigData.venues as any;
          if (venue) {
            setVenueInfo({
              name: venue.name || 'Unknown Venue',
              venueType: venue.venue_type || 'indie_venue',
              capacity: venue.capacity || 200,
            });
            
            const theme = determineStageTheme(
              venue.venue_type || 'indie_venue',
              gigData.time_slot,
              gigData.scheduled_date
            );
            setStageTheme(theme);
          }

          // Fetch band members (only real players, not session/touring musicians)
          if (gigData.band_id) {
            // Don't filter by is_touring_member in query - it may be NULL for real members
            const { data: allMembers } = await supabase
              .from('band_members')
              .select('instrument_role, user_id, is_touring_member')
              .eq('band_id', gigData.band_id)
              .not('user_id', 'is', null);
            
            // Filter client-side: include members where is_touring_member is false OR null
            const members = allMembers?.filter(m => m.is_touring_member !== true) || [];

            if (members && members.length > 0) {
              // Fetch profiles with their player_avatar_config (where RPM avatars are actually stored)
              const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
              const { data: profiles } = await supabase
                .from('profiles')
                .select(`
                  user_id, 
                  avatar_url,
                  player_avatar_config!player_avatar_config_profile_id_fkey(rpm_avatar_url, use_rpm_avatar)
                `)
                .in('user_id', userIds);
              
              // Create a map for easy lookup
              const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

              const roleMap: Record<string, string> = {
                'lead_vocals': 'vocalist',
                'vocals': 'vocalist',
                'Vocals': 'vocalist',
                'lead_guitar': 'guitarist',
                'rhythm_guitar': 'guitarist',
                'guitar': 'guitarist',
                'Guitar': 'guitarist',
                'bass': 'bassist',
                'Bass': 'bassist',
                'drums': 'drummer',
                'Drums': 'drummer',
                'keyboard': 'keyboardist',
                'keys': 'keyboardist',
                'Keyboard': 'keyboardist',
                'DJ/Producer': 'keyboardist',
              };

              const processedMembers: BandMember[] = members.map((member) => {
                const profile = profileMap.get(member.user_id!) as any;

                // Relationship is one-to-one in Supabase types, but PostgREST can return either
                // an object (one-to-one) or an array depending on query shape.
                const avatarConfig = Array.isArray(profile?.player_avatar_config)
                  ? profile.player_avatar_config[0]
                  : profile?.player_avatar_config;

                // Use RPM avatar if available and enabled, otherwise fall back to regular avatar
                const avatarUrl = (avatarConfig?.use_rpm_avatar && avatarConfig?.rpm_avatar_url)
                  ? avatarConfig.rpm_avatar_url
                  : profile?.avatar_url || null;

                return {
                  role: roleMap[member.instrument_role] || roleMap[member.instrument_role.toLowerCase()] || 'vocalist',
                  avatarUrl,
                  instrumentRole: member.instrument_role,
                };
              });
              
              // Include members who have any avatar (RPM or regular)
              const membersWithAvatars = processedMembers.filter(m => m.avatarUrl !== null);
              setBandMembers(membersWithAvatars);
            } else {
              // No real band members found - show empty stage
              setBandMembers([]);
            }
          } else {
            // No band_id - show empty stage
            setBandMembers([]);
          }
        }
      } catch (error) {
        console.error('Error fetching gig data:', error);
        // Show empty stage on error
        setBandMembers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGigData();
  }, [gigId]);

  // Calculate song section based on progress
  useEffect(() => {
    const interval = setInterval(() => {
      const progress = (Date.now() % 15000) / 15000;
      
      if (progress < 0.1) setSongSection('intro');
      else if (progress < 0.25) setSongSection('verse');
      else if (progress < 0.4) setSongSection('chorus');
      else if (progress < 0.55) setSongSection('verse');
      else if (progress < 0.7) setSongSection('chorus');
      else if (progress < 0.8) setSongSection('bridge');
      else if (progress < 0.9) setSongSection('solo');
      else setSongSection('outro');
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Play entrance sound when viewer loads
  useEffect(() => {
    if (crowdSoundsLoaded && !hasPlayedEntranceRef.current && !isLoading) {
      playEntrance();
      hasPlayedEntranceRef.current = true;
    }
  }, [crowdSoundsLoaded, isLoading, playEntrance]);
  
  // Play crowd reaction when song changes
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
  
  // Simulate song progression
  useEffect(() => {
    if (songPerformances.length === 0 || !isAudioPlaying) return;

    const interval = setInterval(() => {
      setCurrentSongIndex((prev) => {
        const next = (prev + 1) % songPerformances.length;
        const currentSong = songPerformances[next];
        if (currentSong) {
          const songMood = Math.min(100, Math.max(0, (currentSong.performance_score / 25) * 100));
          setCrowdMood(songMood);
        }
        
        // Play applause at the end of the setlist
        if (next === 0 && prev === songPerformances.length - 1 && crowdSoundsLoaded) {
          playApplause();
        }
        
        return next;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [songPerformances, isAudioPlaying, crowdSoundsLoaded, playApplause]);
  
  const handleSkipSong = () => {
    if (currentSongIndex < songPerformances.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
      const nextSong = songPerformances[currentSongIndex + 1];
      if (nextSong) {
        const songMood = Math.min(100, Math.max(0, (nextSong.performance_score / 25) * 100));
        setCrowdMood(songMood);
      }
    }
  };
  
  const handlePlayPause = () => {
    setIsAudioPlaying(prev => !prev);
  };

  const handleSongAudioEnded = () => {
    if (currentSongIndex < songPerformances.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Get positioned band members
  const positionedMembers = useMemo(() => {
    const vocalist = bandMembers.find(m => m.role === 'vocalist');
    const guitarist = bandMembers.find(m => m.role === 'guitarist');
    const bassist = bandMembers.find(m => m.role === 'bassist');
    const drummer = bandMembers.find(m => m.role === 'drummer');
    const keyboardist = bandMembers.find(m => m.role === 'keyboardist');
    
    return {
      vocalist,
      guitarist,
      bassist,
      drummer,
      keyboardist,
    };
  }, [bandMembers]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-lg font-bebas">Loading Stage...</div>
        </div>
      </div>
    );
  }

  const currentSong = songPerformances[currentSongIndex];
  const crowdResponseLabel = currentSong?.crowd_response || "mixed";
  const attendancePercentage = gigOutcome?.attendance_percentage || 70;
  const intensity = crowdMood / 100;

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Stage Background */}
      <SimpleStageBackground 
        crowdMood={crowdMood} 
        songSection={songSection} 
        stageTheme={stageTheme}
        isNightShow={isNightShow}
      />
      
      {/* 3D Stage Equipment Layer */}
      <Stage3DEquipment 
        bandMembers={bandMembers.map(m => ({ role: m.role, isPresent: true }))}
        intensity={intensity}
        songSection={songSection}
        crowdMood={crowdMood}
      />
      
      {/* Spotlight Effects */}
      <StageSpotlights crowdMood={crowdMood} songSection={songSection} />
      
      {/* Audio Player - rendered outside minimize block so it keeps playing */}
      {currentSong?.song_audio_url && (
        <GigAudioPlayer
          audioUrl={currentSong.song_audio_url}
          isPlaying={isAudioPlaying}
          onEnded={handleSongAudioEnded}
          volume={isMuted ? 0 : volume}
          hideControls={true}
        />
      )}
      
      {/* Band Members on Stage */}
      <div className="absolute inset-0 flex items-end justify-center pb-4" style={{ zIndex: 25 }}>
        <div className="relative w-full max-w-6xl h-[80vh]">
          {/* Drummer (back center - smaller, higher) */}
          {positionedMembers.drummer && (
            <motion.div
              className="absolute bottom-[40%] left-1/2 -translate-x-1/2 z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <RpmAvatarImage
                avatarUrl={positionedMembers.drummer.avatarUrl}
                role="drummer"
                intensity={intensity}
                songSection={songSection}
                size="md"
              />
            </motion.div>
          )}

          {/* Keyboardist (back left - smaller) */}
          {positionedMembers.keyboardist && (
            <motion.div
              className="absolute bottom-[35%] left-[8%] z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <RpmAvatarImage
                avatarUrl={positionedMembers.keyboardist.avatarUrl}
                role="keyboardist"
                intensity={intensity}
                songSection={songSection}
                size="md"
              />
            </motion.div>
          )}

          {/* Guitarist (front left - spread wider) */}
          {positionedMembers.guitarist && (
            <motion.div
              className="absolute bottom-[5%] left-[5%] z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <RpmAvatarImage
                avatarUrl={positionedMembers.guitarist.avatarUrl}
                role="guitarist"
                intensity={intensity}
                songSection={songSection}
                size="xl"
              />
            </motion.div>
          )}

          {/* Vocalist (front center - prominent) */}
          {positionedMembers.vocalist && (
            <motion.div
              className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <RpmAvatarImage
                avatarUrl={positionedMembers.vocalist.avatarUrl}
                role="vocalist"
                intensity={intensity}
                songSection={songSection}
                size="xl"
              />
            </motion.div>
          )}

          {/* Bassist (front right - spread wider) */}
          {positionedMembers.bassist && (
            <motion.div
              className="absolute bottom-[5%] right-[5%] z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <RpmAvatarImage
                avatarUrl={positionedMembers.bassist.avatarUrl}
                role="bassist"
                intensity={intensity}
                songSection={songSection}
                size="xl"
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Crowd Silhouettes at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end opacity-40">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-6 h-8 bg-black rounded-t-full"
              animate={{
                y: [0, -3, 0],
              }}
              transition={{
                duration: 0.5 + Math.random() * 0.5,
                repeat: Infinity,
                delay: Math.random() * 0.5,
              }}
              style={{
                height: 20 + Math.random() * 20,
              }}
            />
          ))}
        </div>
      </div>

      {/* HUD Overlay */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4 flex justify-between items-start">
        <Card className="bg-black/60 backdrop-blur-sm border-white/20 px-4 py-3">
          <div className="text-white space-y-3">
            {/* Header with minimize button */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs text-white/60">Now Playing</div>
                  <div className="text-base font-bebas">{currentSong?.song_title || "Loading..."}</div>
                  {!isHudMinimized && (
                    <div className="text-xs text-white/40">
                      Song {currentSongIndex + 1} of {songPerformances.length}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsHudMinimized(!isHudMinimized)}
                className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
              >
                {isHudMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
            
            <AnimatePresence>
              {!isHudMinimized && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <div className="space-y-1">
                        <div className="text-xs text-white/60">Crowd Energy</div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500"
                              animate={{ width: `${crowdMood}%` }}
                              transition={{ duration: 1 }}
                            />
                          </div>
                          <span className="text-xs font-medium">{Math.round(crowdMood)}%</span>
                        </div>
                        <div className="text-xs text-white/50 capitalize">{crowdResponseLabel}</div>
                      </div>
                    </div>
                    <div className="text-xs text-white/40">
                      Attendance: {Math.round(attendancePercentage)}% capacity
                    </div>
                    
                    {/* Audio player moved outside minimize block - controls remain here */}
                    
                    {/* Audio Controls */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePlayPause}
                        className="h-8 w-8 text-white hover:bg-white/20"
                      >
                        {isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSkipSong}
                        disabled={currentSongIndex >= songPerformances.length - 1}
                        className="h-8 w-8 text-white hover:bg-white/20 disabled:opacity-30"
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleMuteToggle}
                        className="h-8 w-8 text-white hover:bg-white/20"
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <Slider
                        value={[isMuted ? 0 : volume * 100]}
                        onValueChange={([val]) => {
                          handleVolumeChange(val / 100);
                          if (val > 0) setIsMuted(false);
                        }}
                        max={100}
                        step={1}
                        className="w-20"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="bg-black/60 backdrop-blur-sm hover:bg-white/20 text-white"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="bg-black/60 backdrop-blur-sm hover:bg-white/20 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
