import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Maximize2, Minimize2, Music, Users } from "lucide-react";
import { StageScene } from "./StageScene";
import { CrowdLayer } from "./CrowdLayer";
import { BandAvatars } from "./BandAvatars";
import { LoadingScreen } from "./LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

interface GigViewer3DProps {
  gigId: string;
  onClose: () => void;
}

type GigOutcome = Database['public']['Tables']['gig_outcomes']['Row'];
type SongPerformance = Database['public']['Tables']['gig_song_performances']['Row'];

export const GigViewer3D = ({ gigId, onClose }: GigViewer3DProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [crowdMood, setCrowdMood] = useState(50);
  const [gigOutcome, setGigOutcome] = useState<GigOutcome | null>(null);
  const [songPerformances, setSongPerformances] = useState<SongPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch gig outcome and song performances
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
        setSongPerformances(performances.sort((a, b) => (a.position || 0) - (b.position || 0)));
        
        // Set initial crowd mood based on first song or overall rating
        if (performances.length > 0) {
          const firstSongMood = Math.min(100, Math.max(0, (performances[0].performance_score / 25) * 100));
          setCrowdMood(firstSongMood);
        } else {
          const initialMood = Math.min(100, Math.max(0, (outcome.overall_rating / 25) * 100));
          setCrowdMood(initialMood);
        }
      } catch (error) {
        console.error('Error fetching gig data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGigData();
  }, [gigId]);

  // Simulate song progression
  useEffect(() => {
    if (songPerformances.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSongIndex((prev) => {
        const next = (prev + 1) % songPerformances.length;
        
        // Update crowd mood based on current song performance
        const currentSong = songPerformances[next];
        if (currentSong) {
          const songMood = Math.min(100, Math.max(0, (currentSong.performance_score / 25) * 100));
          setCrowdMood(songMood);
        }
        
        return next;
      });
    }, 15000); // Change song every 15 seconds

    return () => clearInterval(interval);
  }, [songPerformances]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  const currentSong = songPerformances[currentSongIndex];
  const crowdResponseLabel = currentSong?.crowd_response || "mixed";
  const attendancePercentage = gigOutcome?.attendance_percentage || 70;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* HUD Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start">
        <Card className="bg-black/60 backdrop-blur-sm border-white/20 px-4 py-3">
          <div className="text-white space-y-3">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-white/60">Now Playing</div>
                <div className="text-base font-bebas">{currentSong?.song_title || "Loading..."}</div>
                <div className="text-xs text-white/40">
                  Song {currentSongIndex + 1} of {songPerformances.length}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <div className="space-y-1">
                <div className="text-xs text-white/60">Crowd Energy</div>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 transition-all duration-1000"
                      style={{ width: `${crowdMood}%` }}
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

      {/* 3D Canvas */}
      <Canvas shadows>
        <Suspense fallback={<LoadingScreen />}>
          {/* Camera - Fan POV */}
          <PerspectiveCamera
            makeDefault
            position={[0, 1.6, 8]}
            fov={75}
          />
          
          {/* Basic Lighting */}
          <ambientLight intensity={0.3} />
          <spotLight
            position={[0, 10, 0]}
            angle={0.5}
            penumbra={0.5}
            intensity={1}
            castShadow
          />
          <pointLight position={[-5, 5, 5]} intensity={0.5} color="#ff0000" />
          <pointLight position={[5, 5, 5]} intensity={0.5} color="#0000ff" />

          {/* Environment */}
          <Environment preset="night" />

          {/* Scene Components */}
          <StageScene gigId={gigId} />
          <CrowdLayer crowdMood={crowdMood} />
          <BandAvatars gigId={gigId} />

          {/* Controls (limited for POV feel) */}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 3}
            target={[0, 2, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
