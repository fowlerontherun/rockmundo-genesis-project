import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { 
  ProceduralGuitarAmp, 
  ProceduralDrumKit, 
  ProceduralMicStand, 
  ProceduralKeyboard, 
  ProceduralBassAmp, 
  ProceduralStageMonitor,
  ProceduralCableSet
} from "./procedural-equipment";

interface BandMemberInfo {
  role: string;
  isPresent: boolean;
}

interface Stage3DEquipmentProps {
  bandMembers: BandMemberInfo[];
  intensity?: number;
  songSection?: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  crowdMood?: number;
}

// 3D Scene content
const StageEquipmentScene = ({ 
  bandMembers, 
  intensity = 0.5, 
  songSection = 'verse'
}: Stage3DEquipmentProps) => {
  // Determine which equipment to show based on band members
  const equipment = useMemo(() => {
    const hasVocalist = bandMembers.some(m => m.role === 'vocalist' && m.isPresent);
    const hasGuitarist = bandMembers.some(m => m.role === 'guitarist' && m.isPresent);
    const hasBassist = bandMembers.some(m => m.role === 'bassist' && m.isPresent);
    const hasDrummer = bandMembers.some(m => m.role === 'drummer' && m.isPresent);
    const hasKeyboardist = bandMembers.some(m => m.role === 'keyboardist' && m.isPresent);
    
    return { hasVocalist, hasGuitarist, hasBassist, hasDrummer, hasKeyboardist };
  }, [bandMembers]);

  return (
    <>
      {/* Brighter ambient lighting for visibility */}
      <ambientLight intensity={0.6} />
      
      {/* Main stage front wash light */}
      <directionalLight 
        position={[0, 8, 5]} 
        intensity={0.8 + intensity * 0.4} 
        color="#ffffff"
      />
      
      {/* Warm side fill left */}
      <pointLight 
        position={[-4, 4, 2]} 
        intensity={0.6} 
        color="#ffaa66"
        distance={12}
      />
      
      {/* Cool side fill right */}
      <pointLight 
        position={[4, 4, 2]} 
        intensity={0.6} 
        color="#6699ff"
        distance={12}
      />
      
      {/* Back light for rim/separation */}
      <pointLight 
        position={[0, 5, -3]} 
        intensity={0.5} 
        color="#ffffff"
        distance={15}
      />
      
      {/* Floor bounce light */}
      <pointLight 
        position={[0, 0.2, 1]} 
        intensity={0.3} 
        color="#ffddcc"
        distance={8}
      />
      
      {/* Drum Kit - back center - scaled up for visibility */}
      {equipment.hasDrummer && (
        <ProceduralDrumKit 
          position={[0, 0, -1.2]} 
          scale={1.1}
          intensity={intensity}
          songSection={songSection}
        />
      )}
      
      {/* Guitar Amp Stack - left side - scaled up */}
      {equipment.hasGuitarist && (
        <ProceduralGuitarAmp 
          position={[-1.8, 0, -0.5]} 
          scale={1.0}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Bass Amp - right side - scaled up */}
      {equipment.hasBassist && (
        <ProceduralBassAmp 
          position={[1.8, 0, -0.5]} 
          scale={1.0}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Keyboard Setup - back left - scaled up */}
      {equipment.hasKeyboardist && (
        <ProceduralKeyboard 
          position={[-1.2, 0, -0.9]} 
          scale={1.0}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Main Vocal Mic Stand - front center - scaled up */}
      {equipment.hasVocalist && (
        <ProceduralMicStand 
          position={[0, 0, 0.8]} 
          scale={1.1}
          intensity={intensity}
          hasBoomArm={true}
        />
      )}
      
      {/* Backup mic for guitarist - scaled up */}
      {equipment.hasGuitarist && (
        <ProceduralMicStand 
          position={[-1.0, 0, 0.5]} 
          scale={0.9}
          intensity={intensity}
          hasBoomArm={false}
        />
      )}
      
      {/* Backup mic for bassist - scaled up */}
      {equipment.hasBassist && (
        <ProceduralMicStand 
          position={[1.0, 0, 0.5]} 
          scale={0.9}
          intensity={intensity}
          hasBoomArm={false}
        />
      )}
      
      {/* Stage Monitors - facing performers - scaled up */}
      <ProceduralStageMonitor 
        position={[-0.6, 0, 1.0]} 
        scale={1.0}
        intensity={intensity}
        rotation={[0, Math.PI, 0]}
      />
      <ProceduralStageMonitor 
        position={[0.6, 0, 1.0]} 
        scale={1.0}
        intensity={intensity}
        rotation={[0, Math.PI, 0]}
      />
      
      {/* Additional monitors for drummer - scaled up */}
      {equipment.hasDrummer && (
        <ProceduralStageMonitor 
          position={[0, 0, -0.3]} 
          scale={0.9}
          intensity={intensity}
          rotation={[0, Math.PI, 0]}
        />
      )}
      
      {/* Side-fill monitor for keyboardist - scaled up */}
      {equipment.hasKeyboardist && (
        <ProceduralStageMonitor 
          position={[-1.6, 0, -0.2]} 
          scale={0.9}
          intensity={intensity}
          rotation={[0, Math.PI * 0.8, 0]}
        />
      )}
      
      {/* Cables for realism - updated positions */}
      <ProceduralCableSet
        equipmentPositions={{
          guitarAmp: equipment.hasGuitarist ? [-1.8, 0, -0.5] : undefined,
          bassAmp: equipment.hasBassist ? [1.8, 0, -0.5] : undefined,
          drums: equipment.hasDrummer ? [0, 0, -1.2] : undefined,
          keyboard: equipment.hasKeyboardist ? [-1.2, 0, -0.9] : undefined,
          vocalMic: equipment.hasVocalist ? [0, 0, 0.8] : undefined,
        }}
        intensity={intensity}
      />
    </>
  );
};

export const Stage3DEquipment = ({ 
  bandMembers, 
  intensity = 0.5, 
  songSection = 'verse',
  crowdMood = 50
}: Stage3DEquipmentProps) => {
  // Map bandMembers to the format expected by the scene
  const memberInfo: BandMemberInfo[] = useMemo(() => {
    const roles = ['vocalist', 'guitarist', 'bassist', 'drummer', 'keyboardist'];
    return roles.map(role => ({
      role,
      isPresent: bandMembers.some(m => m.role === role && m.isPresent)
    }));
  }, [bandMembers]);

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <Canvas
        camera={{ 
          position: [0, 1.8, 4.5], 
          fov: 50,
          near: 0.1,
          far: 100
        }}
        gl={{ 
          alpha: true, 
          antialias: true,
          powerPreference: "high-performance"
        }}
        frameloop="always"
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <StageEquipmentScene 
            bandMembers={memberInfo}
            intensity={intensity}
            songSection={songSection}
            crowdMood={crowdMood}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
