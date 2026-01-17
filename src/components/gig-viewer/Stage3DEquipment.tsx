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
      {/* Ambient lighting */}
      <ambientLight intensity={0.3} />
      
      {/* Stage lighting */}
      <directionalLight 
        position={[0, 5, 2]} 
        intensity={0.5 + intensity * 0.3} 
        color="#ffffff"
      />
      <pointLight 
        position={[-3, 3, 1]} 
        intensity={0.4} 
        color="#ff6666"
        distance={10}
      />
      <pointLight 
        position={[3, 3, 1]} 
        intensity={0.4} 
        color="#6666ff"
        distance={10}
      />
      
      {/* Drum Kit - back center */}
      {equipment.hasDrummer && (
        <ProceduralDrumKit 
          position={[0, 0, -1.5]} 
          scale={0.9}
          intensity={intensity}
          songSection={songSection}
        />
      )}
      
      {/* Guitar Amp Stack - left side */}
      {equipment.hasGuitarist && (
        <ProceduralGuitarAmp 
          position={[-2.2, 0, -0.8]} 
          scale={0.85}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Bass Amp - right side */}
      {equipment.hasBassist && (
        <ProceduralBassAmp 
          position={[2.2, 0, -0.8]} 
          scale={0.85}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Keyboard Setup - back left */}
      {equipment.hasKeyboardist && (
        <ProceduralKeyboard 
          position={[-1.5, 0, -1.2]} 
          scale={0.8}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Main Vocal Mic Stand - front center */}
      {equipment.hasVocalist && (
        <ProceduralMicStand 
          position={[0, 0, 0.5]} 
          scale={0.9}
          intensity={intensity}
          hasBoomArm={true}
        />
      )}
      
      {/* Backup mic for guitarist */}
      {equipment.hasGuitarist && (
        <ProceduralMicStand 
          position={[-1.2, 0, 0.3]} 
          scale={0.75}
          intensity={intensity}
          hasBoomArm={false}
        />
      )}
      
      {/* Backup mic for bassist */}
      {equipment.hasBassist && (
        <ProceduralMicStand 
          position={[1.2, 0, 0.3]} 
          scale={0.75}
          intensity={intensity}
          hasBoomArm={false}
        />
      )}
      
      {/* Stage Monitors - facing performers */}
      <ProceduralStageMonitor 
        position={[-0.8, 0, 0.8]} 
        scale={0.8}
        intensity={intensity}
        rotation={[0, Math.PI, 0]}
      />
      <ProceduralStageMonitor 
        position={[0.8, 0, 0.8]} 
        scale={0.8}
        intensity={intensity}
        rotation={[0, Math.PI, 0]}
      />
      
      {/* Additional monitors for drummer */}
      {equipment.hasDrummer && (
        <ProceduralStageMonitor 
          position={[0, 0, -0.5]} 
          scale={0.7}
          intensity={intensity}
          rotation={[0, Math.PI, 0]}
        />
      )}
      
      {/* Side-fill monitor for keyboardist */}
      {equipment.hasKeyboardist && (
        <ProceduralStageMonitor 
          position={[-2, 0, -0.3]} 
          scale={0.7}
          intensity={intensity}
          rotation={[0, Math.PI * 0.8, 0]}
        />
      )}
      
      {/* Cables for realism */}
      <ProceduralCableSet
        equipmentPositions={{
          guitarAmp: equipment.hasGuitarist ? [-2.2, 0, -0.8] : undefined,
          bassAmp: equipment.hasBassist ? [2.2, 0, -0.8] : undefined,
          drums: equipment.hasDrummer ? [0, 0, -1.5] : undefined,
          keyboard: equipment.hasKeyboardist ? [-1.5, 0, -1.2] : undefined,
          vocalMic: equipment.hasVocalist ? [0, 0, 0.5] : undefined,
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
      style={{ zIndex: 5 }}
    >
      <Canvas
        camera={{ 
          position: [0, 2, 6], 
          fov: 45,
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
