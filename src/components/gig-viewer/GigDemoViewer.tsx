import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { StageScene } from "./StageScene";
import { OptimizedCrowdLayer } from "./OptimizedCrowdLayer";
import { EnhancedBandAvatars3D } from "./EnhancedBandAvatars3D";
import { OutdoorEnvironment } from "./OutdoorEnvironment";
import { LoadingScreen } from "./LoadingScreen";
import { StageLighting } from "./StageLighting";
import { CameraRig } from "./CameraRig";
import { StageFloor } from './StageFloor';
import { StageEquipment } from './StageEquipment';
import { StageEffects } from "./StageEffects";
import { LightCone } from "./LightCone";
import { CrowdBarrier } from "./CrowdBarrier";
import { VenueEnvironment, type VenueTheme } from './VenueEnvironment';
import { RPM_BAND_AVATARS } from "@/data/rpmAvatarPool";

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
  bandName?: string;
  songSection: SongSection;
  isOutdoor?: boolean;
  timeOfDay?: 'day' | 'sunset' | 'night';
  cameraMode?: CameraMode;
  zoomLevel?: number;
  venueTheme?: VenueTheme;
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
  bandName = "ROCKMUNDO",
  songSection,
  isOutdoor = false,
  timeOfDay = 'night',
  cameraMode = 'pov',
  zoomLevel = 13,
  venueTheme = 'default',
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

  // Demo band member configs with RPM avatars
  const demoBandConfigs = {
    vocalist: {
      rpm_avatar_url: RPM_BAND_AVATARS[0],
      use_rpm_avatar: true,
    },
    guitarist: {
      rpm_avatar_url: RPM_BAND_AVATARS[1],
      use_rpm_avatar: true,
    },
    bassist: {
      rpm_avatar_url: RPM_BAND_AVATARS[2],
      use_rpm_avatar: true,
    },
    drummer: {
      rpm_avatar_url: RPM_BAND_AVATARS[3],
      use_rpm_avatar: true,
    },
    keyboardist: {
      rpm_avatar_url: RPM_BAND_AVATARS[4],
      use_rpm_avatar: true,
    },
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

          {/* Venue-themed environment elements */}
          <VenueEnvironment venueTheme={venueTheme} />

          {/* Stage Equipment */}
          <StageEquipment />

          {/* Stage scene */}
          <StageScene stageTemplateId={stageTemplateId} />

          {/* Crowd barrier */}
          <CrowdBarrier />
          
          {/* 3D Procedural Crowd */}
          <OptimizedCrowdLayer 
            crowdMood={crowdMood}
            bandFame={bandFame}
            bandMerchColor={merchColor}
            bandName={bandName}
            maxCrowdCount={maxCrowdCount}
            densityMultiplier={crowdDensity}
          />
          
          {/* 3D Band Members with RPM avatars */}
          <EnhancedBandAvatars3D
            songProgress={0.5}
            songSection={songSection}
            crowdMood={crowdMood}
            bandMemberConfigs={demoBandConfigs}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
