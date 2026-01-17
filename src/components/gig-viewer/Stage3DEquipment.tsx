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
      
      {/* Stage floor plane for grounding */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          roughness={0.8}
          metalness={0.2}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Drum Kit - pushed further back, smaller scale */}
      {equipment.hasDrummer && (
        <ProceduralDrumKit 
          position={[0, 0, -2.5]} 
          scale={0.7}
          intensity={intensity}
          songSection={songSection}
        />
      )}
      
      {/* Guitar Amp Stack - far left, pushed back */}
      {equipment.hasGuitarist && (
        <ProceduralGuitarAmp 
          position={[-2.8, 0, -1.8]} 
          scale={0.65}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Bass Amp - far right, pushed back */}
      {equipment.hasBassist && (
        <ProceduralBassAmp 
          position={[2.8, 0, -1.8]} 
          scale={0.65}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Keyboard Setup - back left corner */}
      {equipment.hasKeyboardist && (
        <ProceduralKeyboard 
          position={[-2.2, 0, -2.2]} 
          scale={0.6}
          intensity={intensity}
          isActive={true}
        />
      )}
      
      {/* Minimal mic stands - only vocalist, positioned to not block */}
      {equipment.hasVocalist && (
        <ProceduralMicStand 
          position={[0, 0, -0.5]} 
          scale={0.7}
          intensity={intensity}
          hasBoomArm={true}
        />
      )}
      
      {/* Removed front stage monitors that were blocking view */}
      {/* Only keep small side monitors at edges */}
      <ProceduralStageMonitor 
        position={[-3.5, 0, 0]} 
        scale={0.5}
        intensity={intensity}
        rotation={[0, Math.PI * 0.3, 0]}
      />
      <ProceduralStageMonitor 
        position={[3.5, 0, 0]} 
        scale={0.5}
        intensity={intensity}
        rotation={[0, -Math.PI * 0.3, 0]}
      />
      
      {/* Cables for realism - updated positions */}
      <ProceduralCableSet
        equipmentPositions={{
          guitarAmp: equipment.hasGuitarist ? [-2.8, 0, -1.8] : undefined,
          bassAmp: equipment.hasBassist ? [2.8, 0, -1.8] : undefined,
          drums: equipment.hasDrummer ? [0, 0, -2.5] : undefined,
          keyboard: equipment.hasKeyboardist ? [-2.2, 0, -2.2] : undefined,
          vocalMic: equipment.hasVocalist ? [0, 0, -0.5] : undefined,
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
          position: [0, 3, 7], 
          fov: 40,
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
