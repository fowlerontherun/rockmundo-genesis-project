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

      {/* Lighting truss structure - more detailed */}
      <group position={[0, 7, -6]}>
        {/* Main horizontal truss */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[14, 0.3, 0.3]} />
          <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* Truss supports */}
        <mesh position={[-6, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
          <boxGeometry args={[0.2, 2, 0.2]} />
          <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[6, 0, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <boxGeometry args={[0.2, 2, 0.2]} />
          <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Light fixtures on truss */}
        {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
          <mesh key={i} position={[x, -0.5, 0]}>
            <cylinderGeometry args={[0.2, 0.15, 0.4, 8]} />
            <meshStandardMaterial color="#111111" metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Stage monitors - wedge speakers pointing at band */}
      <mesh position={[-2, 0.3, -4]} rotation={[-Math.PI / 6, 0, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[2, 0.3, -4]} rotation={[-Math.PI / 6, 0, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Additional Mic Stands */}
      {/* Center mic stand (vocalist) */}
      <group position={[0, 0, -4]}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.4, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
      </group>

      {/* Boom mic stand (guitarist vocals) */}
      <group position={[-2, 0, -5]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
        <mesh position={[0.3, 1.2, 0]} rotation={[0, 0, Math.PI / 3]}>
          <cylinderGeometry args={[0.012, 0.012, 0.6, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
        <mesh position={[0.55, 1.2, 0]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
      </group>

      {/* Drummer overhead mic */}
      <group position={[0, 0, -7]}>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshStandardMaterial color="#333333" metalness={0.8} />
        </mesh>
      </group>

      {/* Keyboard Setup (stage left) */}
      <group position={[-4, 0, -5]}>
        {/* Keyboard stand */}
        <mesh position={[-0.3, 0.4, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.7} />
        </mesh>
        <mesh position={[0.3, 0.4, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.7} />
        </mesh>
        {/* Keyboard platform */}
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.8, 0.02, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Guitar Pedalboards */}
      {/* Guitarist pedalboard */}
      <group position={[-2, 0.02, -4.5]}>
        <mesh>
          <boxGeometry args={[0.4, 0.03, 0.25]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Individual pedals */}
        {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0]}>
            <boxGeometry args={[0.06, 0.03, 0.08]} />
            <meshStandardMaterial color={['#ff0000', '#0000ff', '#00ff00', '#ffff00'][i]} metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Bassist pedalboard */}
      <group position={[2, 0.02, -4.5]}>
        <mesh>
          <boxGeometry args={[0.3, 0.03, 0.2]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {[-0.08, 0, 0.08].map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0]}>
            <boxGeometry args={[0.06, 0.03, 0.08]} />
            <meshStandardMaterial color={['#8b0000', '#4b0082'][i % 2]} metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Side-fill Monitors */}
      <mesh position={[-5, 0.5, -3]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[5, 0.5, -3]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Subwoofer cabinets */}
      <mesh position={[-6.5, 0.4, -2]}>
        <boxGeometry args={[0.9, 0.8, 1]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[6.5, 0.4, -2]}>
        <boxGeometry args={[0.9, 0.8, 1]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Guitar stands (backup guitars) */}
      <group position={[-3.5, 0, -3.5]}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.02, 0.08, 0.8, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.6, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.12, 0.4, 0.04]} />
          <meshStandardMaterial color="#ff4500" metalness={0.5} />
        </mesh>
      </group>

      {/* Water bottles on stage */}
      <mesh position={[-1.8, 0.05, -3.5]}>
        <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
        <meshStandardMaterial color="#87ceeb" transparent opacity={0.6} />
      </mesh>
      <mesh position={[1.8, 0.05, -3.5]}>
        <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
        <meshStandardMaterial color="#87ceeb" transparent opacity={0.6} />
      </mesh>

      {/* Setlist papers */}
      <mesh position={[-0.3, 0.01, -3.8]} rotation={[-Math.PI / 2, 0, 0.1]}>
        <planeGeometry args={[0.1, 0.15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.3, 0.01, -3.8]} rotation={[-Math.PI / 2, 0, -0.1]}>
        <planeGeometry args={[0.1, 0.15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Barrier rails */}
      <group position={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[12, 0.1, 0.1]} />
          <meshStandardMaterial color="#333333" metalness={0.7} />
        </mesh>
        <mesh position={[-5.5, -0.25, 0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#333333" metalness={0.7} />
        </mesh>
        <mesh position={[5.5, -0.25, 0]}>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#333333" metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
};
