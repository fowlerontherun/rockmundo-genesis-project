import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import ampStackTexture from "@/assets/textures/equipment/amp-stack.png";
import paSpeakerTexture from "@/assets/textures/equipment/pa-speaker.png";
import drumKitTexture from "@/assets/textures/equipment/drum-kit.png";

export const StageEquipment = () => {
  // Load equipment textures
  const ampTexture = useLoader(TextureLoader, ampStackTexture);
  const speakerTexture = useLoader(TextureLoader, paSpeakerTexture);
  const drumTexture = useLoader(TextureLoader, drumKitTexture);

  return (
    <group>
      {/* Left PA Speaker Stack */}
      <mesh position={[-6, 1.5, -2]} castShadow>
        <boxGeometry args={[0.8, 3, 1]} />
        <meshStandardMaterial map={speakerTexture} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Right PA Speaker Stack */}
      <mesh position={[6, 1.5, -2]} castShadow>
        <boxGeometry args={[0.8, 3, 1]} />
        <meshStandardMaterial map={speakerTexture} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Left Guitar Amp Stack (behind lead guitarist) */}
      <mesh position={[-3, 0.8, -3]} castShadow>
        <boxGeometry args={[0.6, 1.6, 0.6]} />
        <meshStandardMaterial map={ampTexture} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Right Guitar Amp Stack (behind rhythm guitarist) */}
      <mesh position={[3, 0.8, -3]} castShadow>
        <boxGeometry args={[0.6, 1.6, 0.6]} />
        <meshStandardMaterial map={ampTexture} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Drum Kit (center back, elevated) */}
      <mesh position={[0, 0.5, -4]} castShadow>
        <planeGeometry args={[2.5, 2]} />
        <meshStandardMaterial 
          map={drumTexture} 
          transparent 
          alphaTest={0.1}
          roughness={0.5} 
          metalness={0.5} 
        />
      </mesh>

      {/* Stage Monitor Wedges */}
      <mesh position={[-2, 0.15, 0]} castShadow rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      <mesh position={[2, 0.15, 0]} castShadow rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, -1]} castShadow rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      {/* Cable runs on stage floor */}
      <mesh position={[-2, 0.01, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.1, 5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} />
      </mesh>
      <mesh position={[2, 0.01, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.1, 5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={1} />
      </mesh>

      {/* Lighting Truss Structure (above stage) */}
      <mesh position={[0, 5, -2]} castShadow>
        <boxGeometry args={[12, 0.2, 0.2]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[-5, 5, -2]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1, 0.15, 0.15]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[5, 5, -2]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1, 0.15, 0.15]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
};
