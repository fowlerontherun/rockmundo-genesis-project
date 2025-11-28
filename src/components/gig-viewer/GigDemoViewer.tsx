import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { StageScene } from "./StageScene";
import { Crowd3DLayer } from "./Crowd3DLayer";
import { BandMember3D } from "./BandMember3D";
import { OutdoorEnvironment } from "./OutdoorEnvironment";
import { LoadingScreen } from "./LoadingScreen";
import { StageLighting } from "./StageLighting";
import { CameraRig } from "./CameraRig";
import { StageFloor } from './StageFloor';
import { StageEquipment } from './StageEquipment';
import { StageEffects } from "./StageEffects";
import { LightCone } from "./LightCone";
import { CrowdBarrier } from "./CrowdBarrier";

type SongSection = 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
type PerformanceTier = 'low' | 'medium' | 'high';
type CameraMode = 'pov' | 'orbit' | 'free' | 'cinematic';

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
  isOutdoor?: boolean;
  timeOfDay?: 'day' | 'sunset' | 'night';
  cameraMode?: CameraMode;
  zoomLevel?: number;
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
  isOutdoor = false,
  timeOfDay = 'night',
  cameraMode = 'pov',
  zoomLevel = 13,
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
    <div className="relative w-full h-full bg-black touch-none">
      {/* FPS Counter */}
      <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-mono">
        {fps} FPS
      </div>

      {/* Info Overlay */}
      <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm px-2 md:px-4 py-2 md:py-3 rounded space-y-1 md:space-y-2 text-white text-xs">
        <div className="font-semibold hidden md:block">Live Preview</div>
        <div className="space-y-1 text-white/70">
          <div>Mood: {crowdMood}%</div>
          <div className="hidden sm:block">Section: {songSection.toUpperCase()}</div>
          <div className="hidden md:block">Quality: {performanceTier.toUpperCase()}</div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas 
        shadows={enableShadows} 
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        camera={{ fov: 75, near: 0.1, far: 1000 }}
      >
        <Suspense fallback={<LoadingScreen />}>
          {/* Multi-mode camera system */}
          <CameraRig 
            crowdMood={crowdMood} 
            stageTemplateId={stageTemplateId}
            mode={cameraMode}
            zoomLevel={zoomLevel}
          />
          
          {/* Base ambient light */}
          <ambientLight intensity={0.15} />
          
          {/* Fog for atmosphere */}
          <fog attach="fog" args={["#000000", 5, 30]} />

          {/* Dynamic stage lighting system */}
          <StageLighting 
            crowdMood={crowdMood} 
            songIntensity={songIntensity}
            stageTemplateId={stageTemplateId}
            enableShadows={enableShadows}
            songSection={songSection}
          />

          {/* Volumetric light cones */}
          <LightCone position={[-4, 6, -6]} color="#ff00ff" intensity={songIntensity} />
          <LightCone position={[0, 6, -6]} color="#00ffff" intensity={songIntensity} />
          <LightCone position={[4, 6, -6]} color="#ffff00" intensity={songIntensity} />

          {/* Stage effects (haze, particles) */}
          <StageEffects 
            crowdMood={crowdMood} 
            songIntensity={songIntensity}
            songSection={songSection}
          />

          {/* Environment */}
          {isOutdoor ? (
            <OutdoorEnvironment timeOfDay={timeOfDay} />
          ) : (
            <Environment preset="night" />
          )}

          {/* Stage floor and backdrop */}
          <StageFloor floorType={floorType} backdropType={backdropType} />

          {/* Stage Equipment */}
          <StageEquipment />

          {/* Stage scene */}
          <StageScene stageTemplateId={stageTemplateId} />

          {/* Crowd barrier */}
          <CrowdBarrier />
          
          {/* 3D Procedural Crowd */}
          <Crowd3DLayer 
            crowdMood={crowdMood}
            bandFame={bandFame}
            bandMerchColor={merchColor}
            maxCrowdCount={maxCrowdCount}
            densityMultiplier={crowdDensity}
          />
          
          {/* 3D Band Members */}
          <BandMember3D 
            position={[-2, 1, -5]}
            instrument="guitarist"
            animationState={songSection === 'intro' ? 'intro' : songSection === 'solo' ? 'solo' : 'playing'}
            intensity={songIntensity}
            seed={0.1}
          />
          <BandMember3D 
            position={[2, 1, -5]}
            instrument="bassist"
            animationState={songSection === 'intro' ? 'intro' : 'playing'}
            intensity={songIntensity}
            seed={0.3}
          />
          <BandMember3D 
            position={[0, 1.6, -7]}
            instrument="drummer"
            animationState={songSection === 'intro' ? 'intro' : 'playing'}
            intensity={songIntensity}
            seed={0.5}
          />
          <BandMember3D 
            position={[0, 1, -4]}
            instrument="vocalist"
            animationState={songSection === 'intro' ? 'intro' : songSection === 'outro' ? 'outro' : 'playing'}
            intensity={songIntensity}
            seed={0.7}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
