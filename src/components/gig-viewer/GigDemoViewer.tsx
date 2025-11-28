import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { StageScene } from "./StageScene";
import { CrowdLayer } from "./CrowdLayer";
import { BandAvatars } from "./BandAvatars";
import { LoadingScreen } from "./LoadingScreen";
import { StageLighting } from "./StageLighting";
import { CameraRig } from "./CameraRig";
import { StageEffects } from "./StageEffects";

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

          {/* Stage effects (haze, particles) */}
          <StageEffects crowdMood={crowdMood} />

          {/* Environment */}
          <Environment preset="night" />

          {/* Simple floor - NO TEXTURES */}
          <mesh position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[30, 30]} />
            <meshStandardMaterial 
              color="#1a0033"
              emissive="#1a0033"
              emissiveIntensity={0.1}
              roughness={0.8}
              metalness={0.2}
            />
          </mesh>
          
          {/* Stage platform - NO TEXTURES */}
          <mesh position={[0, 0.05, -5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[12, 6]} />
            <meshStandardMaterial 
              color="#330066"
              emissive="#330066"
              emissiveIntensity={0.15}
              roughness={0.6}
              metalness={0.4}
            />
          </mesh>
          
          {/* Backdrop - NO TEXTURES */}
          <mesh position={[0, 4, -8]} receiveShadow>
            <planeGeometry args={[14, 8]} />
            <meshStandardMaterial 
              color="#000000"
              roughness={0.9}
              metalness={0.1}
            />
          </mesh>

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
        </Suspense>
      </Canvas>
    </div>
  );
};
