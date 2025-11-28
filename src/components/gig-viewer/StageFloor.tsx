import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import venueFloorTexture from "@/assets/textures/venue/venue-floor-concrete.png";
import stageBackdropTexture from "@/assets/textures/venue/stage-backdrop-led.png";

interface StageFloorProps {
  floorType?: string;
  backdropType?: string;
}

export const StageFloor = ({ floorType = 'wood', backdropType = 'curtain-black' }: StageFloorProps) => {
  // Load realistic venue textures
  const venueFloor = useLoader(TextureLoader, venueFloorTexture);
  const stageBackdrop = useLoader(TextureLoader, stageBackdropTexture);

  return (
    <>
      {/* Main venue floor with realistic concrete texture */}
      <mesh position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          map={venueFloor}
          roughness={0.95}
          metalness={0.05}
        />
      </mesh>
      
      {/* Stage platform - elevated wooden stage */}
      <mesh position={[0, 0.05, -5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial 
          color="#0a0a0a"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      
      {/* Backdrop with realistic stage backdrop texture */}
      <mesh position={[0, 4, -8]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial 
          map={stageBackdrop}
          roughness={0.7}
          metalness={0.4}
          emissive="#0a1a3a"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Side walls for venue depth */}
      <mesh position={[-7, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[15, 5]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>
      <mesh position={[7, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[15, 5]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>
    </>
  );
};
