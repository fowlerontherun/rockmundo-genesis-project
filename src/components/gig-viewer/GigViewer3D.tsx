import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Maximize2, Minimize2, Music, Users } from "lucide-react";
import { StageScene } from "./StageScene";
import { CrowdLayer } from "./CrowdLayer";
import { BandAvatars } from "./BandAvatars";
import { LoadingScreen } from "./LoadingScreen";
import { StageFloor } from "./StageFloor";
import { StageLighting } from "./StageLighting";
import { CameraRig } from "./CameraRig";
import { StageEffects } from "./StageEffects";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { usePerformanceSettings } from "@/hooks/usePerformanceSettings";

interface GigViewer3DProps {
  gigId: string;
  onClose: () => void;
  previewMode?: boolean;
  previewCrowdMood?: number;
  previewIntensity?: number;
}

type GigOutcome = Database['public']['Tables']['gig_outcomes']['Row'];
type SongPerformance = Database['public']['Tables']['gig_song_performances']['Row'];

export const GigViewer3D = ({ gigId, onClose, previewMode = false, previewCrowdMood, previewIntensity }: GigViewer3DProps) => {
  const performanceSettings = usePerformanceSettings();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [crowdMood, setCrowdMood] = useState(50);
  const [songIntensity, setSongIntensity] = useState(0.5);
  const [gigOutcome, setGigOutcome] = useState<GigOutcome | null>(null);
  const [songPerformances, setSongPerformances] = useState<SongPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(!previewMode);
  const [stageTemplateId, setStageTemplateId] = useState<string | null>(null);
  const [bandFame, setBandFame] = useState(100);
  const [bandMerchColor, setBandMerchColor] = useState("#ff0000");
  const [songSection, setSongSection] = useState<'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro'>('intro');
  const [bandId, setBandId] = useState<string | null>(null);

  // Update preview mode values
  useEffect(() => {
    if (previewMode) {
      setCrowdMood(previewCrowdMood || 50);
      setSongIntensity((previewIntensity || 50) / 100);
    }
  }, [previewMode, previewCrowdMood, previewIntensity]);

  // Fetch gig data (skip in preview mode)
  useEffect(() => {
    if (previewMode) return;
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

        // Fetch gig to get venue and stage template
        const { data: gigData } = await supabase
          .from('gigs')
          .select('venue_id, bands(fame)')
          .eq('id', gigId)
          .single();

        if (gigData) {
          // Get band fame
          const bandData = gigData.bands as any;
          if (bandData) {
            setBandFame(bandData.fame || 0);
          }

          // Get venue's default stage template by capacity
          if (gigData.venue_id) {
            const { data: venueData } = await supabase
              .from('venues')
              .select('capacity')
              .eq('id', gigData.venue_id)
              .single();

            if (venueData?.capacity) {
              // Match venue capacity to stage template
              const { data: templateData } = await supabase
                .from('stage_templates')
                .select('id')
                .lte('capacity_min', venueData.capacity)
                .gte('capacity_max', venueData.capacity)
                .limit(1)
                .maybeSingle();

              if (templateData?.id) {
                setStageTemplateId(templateData.id);
              }
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

  // Calculate song section based on progress
  useEffect(() => {
    const interval = setInterval(() => {
      const progress = (Date.now() % 15000) / 15000; // 15 second cycle
      
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

  if (isLoading) {
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
      <Canvas shadows gl={{ antialias: true, alpha: false }}>
        <Suspense fallback={<LoadingScreen />}>
          {/* Camera with dynamic movement */}
          <CameraRig crowdMood={crowdMood} stageTemplateId={stageTemplateId} />
          
          {/* Base ambient light */}
          <ambientLight intensity={0.15} />
          
          {/* Fog for atmosphere */}
          <fog attach="fog" args={["#000000", 5, 25]} />

          {/* Dynamic stage lighting system */}
          <StageLighting 
            crowdMood={crowdMood} 
            songIntensity={currentSong ? 0.7 : 0.5}
            stageTemplateId={stageTemplateId}
          />

          {/* Stage effects (haze, particles) */}
          <StageEffects crowdMood={crowdMood} />

          {/* Environment */}
          <Environment preset="night" />

          {/* Scene Components */}
          <StageFloor />
          <StageScene stageTemplateId={stageTemplateId} />
          <CrowdLayer 
            crowdMood={crowdMood}
            stageTemplateId={stageTemplateId}
            bandFame={bandFame}
            bandMerchColor={bandMerchColor}
            maxCrowdCount={performanceSettings.maxCrowdCount}
            densityMultiplier={performanceSettings.crowdDensity}
          />
          <BandAvatars 
            gigId={gigId}
            bandId={bandId}
            songProgress={currentSongIndex / Math.max(songPerformances.length, 1)}
            songSection={songSection}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
