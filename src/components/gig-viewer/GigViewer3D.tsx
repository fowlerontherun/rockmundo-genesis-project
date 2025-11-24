import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { StageScene } from "./StageScene";
import { CrowdLayer } from "./CrowdLayer";
import { BandAvatars } from "./BandAvatars";
import { LoadingScreen } from "./LoadingScreen";

interface GigViewer3DProps {
  gigId: string;
  onClose: () => void;
}

export const GigViewer3D = ({ gigId, onClose }: GigViewer3DProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSong, setCurrentSong] = useState("Opening Song");
  const [crowdMood, setCrowdMood] = useState(50);

  useEffect(() => {
    // Simulate song progression
    const interval = setInterval(() => {
      setCrowdMood(prev => Math.min(100, prev + Math.random() * 10 - 3));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* HUD Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start">
        <Card className="bg-black/60 backdrop-blur-sm border-white/20 px-4 py-2">
          <div className="text-white space-y-1">
            <div className="text-sm font-oswald">Now Playing</div>
            <div className="text-lg font-bebas">{currentSong}</div>
            <div className="flex items-center gap-2 text-xs">
              <span>Crowd Energy:</span>
              <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${crowdMood}%` }}
                />
              </div>
              <span>{Math.round(crowdMood)}%</span>
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

          {/* Controls (disabled for now to maintain POV) */}
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
