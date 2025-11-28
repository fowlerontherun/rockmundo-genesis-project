import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { StageScene } from "./StageScene";
import { CrowdLayer } from "./CrowdLayer";
import { BandAvatars } from "./BandAvatars";
import { LoadingScreen } from "./LoadingScreen";
import { StageFloor } from "./StageFloor";
import { StageLighting } from "./StageLighting";
import { CameraRig } from "./CameraRig";
import { StageEffects } from "./StageEffects";
import { StageFog } from "./StageFog";
import { LightBeams } from "./LightBeams";
import { PostProcessing } from "./PostProcessing";

type SongSection = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
type PerformanceTier = 'low' | 'medium' | 'high';

interface GigDemoViewerProps {
  crowdMood: number;
  bandFame: number;
  songIntensity: number;
  crowdDensity: number;
  maxCrowdCount: number;
  performanceTier: PerformanceTier;
  enableShadows: boolean;
  enablePostProcessing: boolean;
  stageTemplateId: string | null;
  floorType: string;
  backdropType: string;
  merchColor: string;
  songSection: SongSection;
}

export const GigDemoViewer = ({
  crowdMood,
  bandFame,
  songIntensity,
  crowdDensity,
  maxCrowdCount,
  performanceTier,
  enableShadows,
  enablePostProcessing,
  stageTemplateId,
  floorType,
  backdropType,
  merchColor,
  songSection,
}: GigDemoViewerProps) => {
  const [fps, setFps] = useState(60);

  // FPS counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const countFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(countFPS);
    };
    
    const rafId = requestAnimationFrame(countFPS);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Mock band member skills for demo
  const mockBandMemberSkills = {
    guitarist1: 75,
    guitarist2: 70,
    bassist: 80,
    drummer: 85,
    vocalist: 90,
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* FPS Counter */}
      <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-sm px-3 py-1 rounded text-white text-xs font-mono">
        FPS: {fps}
      </div>

      {/* Info Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm px-4 py-3 rounded space-y-2 text-white text-xs">
        <div className="font-semibold">Live Preview</div>
        <div className="space-y-1 text-white/70">
          <div>Mood: {crowdMood}%</div>
          <div>Section: {songSection.toUpperCase()}</div>
          <div>Quality: {performanceTier.toUpperCase()}</div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas shadows={enableShadows} gl={{ antialias: true, alpha: false }}>
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
            songIntensity={songIntensity}
            stageTemplateId={stageTemplateId}
            enableShadows={enableShadows}
          />

          {/* Light beams */}
          {performanceTier !== 'low' && (
            <LightBeams 
              count={6}
              intensity={songIntensity}
            />
          )}

          {/* Stage fog */}
          {performanceTier === 'high' && (
            <StageFog 
              intensity={songIntensity * 0.8}
              count={performanceTier === 'high' ? 20 : 10}
            />
          )}

          {/* Stage effects (haze, particles) */}
          <StageEffects crowdMood={crowdMood} />

          {/* Environment */}
          <Environment preset="night" />

          {/* Scene Components */}
          <StageFloor floorType={floorType} backdropType={backdropType} />
          <StageScene stageTemplateId={stageTemplateId} />
          <CrowdLayer 
            crowdMood={crowdMood}
            stageTemplateId={stageTemplateId}
            bandFame={bandFame}
            bandMerchColor={merchColor}
            maxCrowdCount={maxCrowdCount}
            densityMultiplier={crowdDensity}
          />
          <BandAvatars 
            gigId="demo-gig"
            bandId="demo-band"
            songProgress={0.5}
            songSection={songSection}
            bandMemberSkills={mockBandMemberSkills}
          />

          {/* Post-processing effects */}
          {enablePostProcessing && (
            <PostProcessing 
              performanceTier={performanceTier}
              intensity={songIntensity}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
};
