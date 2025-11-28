import { useRef } from "react";
import { Mesh, Group } from "three";
import { useFrame } from "@react-three/fiber";
import { CharacterHair } from "./CharacterHair";
import { FaceFeatures } from "./FaceFeatures";
import { Instruments3D } from "./Instruments3D";

interface BandMember3DProps {
  position: [number, number, number];
  instrument: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  animationState: 'idle' | 'intro' | 'playing' | 'solo' | 'outro';
  intensity: number;
  seed: number;
}

export const BandMember3D = ({
  position,
  instrument,
  animationState,
  intensity,
  seed
}: BandMember3DProps) => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const instrumentRef = useRef<Mesh>(null);

  const hairTypes: Array<'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy'> = [
    'rocker', 'messy', 'mohawk', 'long-straight'
  ];
  const hairType = hairTypes[Math.floor(seed * 4) % 4];
  const hairColors = ['#1a1a1a', '#3d2616', '#8b4513', '#daa520'];
  const hairColor = hairColors[Math.floor(seed * 4) % 4];

  // Animation based on instrument and state
  useFrame(({ clock }) => {
    if (!groupRef.current || !bodyRef.current || !headRef.current) return;

    const time = clock.getElapsedTime() + seed * 5;
    const power = intensity * 0.5;

    if (animationState === 'idle' || animationState === 'intro') {
      bodyRef.current.position.y = 1 + Math.sin(time * 0.5) * 0.02;
      return;
    }

    switch (instrument) {
      case 'vocalist':
        bodyRef.current.position.y = 1 + Math.sin(time * 2) * 0.05 * power;
        headRef.current.rotation.x = Math.sin(time * 1.5) * 0.1 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 1.5;
          rightArmRef.current.rotation.z = -1.5;
        }
        break;

      case 'guitarist':
      case 'bassist':
        bodyRef.current.position.y = 1 + Math.sin(time * 1.5) * 0.03 * power;
        bodyRef.current.rotation.z = Math.sin(time * 0.8) * 0.05 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.8 + Math.sin(time * 4) * 0.2 * power;
          rightArmRef.current.rotation.z = -0.6 - Math.sin(time * 4) * 0.3 * power;
        }
        if (animationState === 'solo' && instrumentRef.current) {
          instrumentRef.current.position.y = 0.6 + Math.sin(time * 3) * 0.1;
        }
        break;

      case 'drummer':
        bodyRef.current.position.y = 1 + Math.abs(Math.sin(time * 3)) * 0.08 * power;
        headRef.current.rotation.x = Math.sin(time * 3) * 0.15 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.5 + Math.sin(time * 6) * 0.8 * power;
          rightArmRef.current.rotation.z = -0.5 - Math.sin(time * 6 + 1) * 0.8 * power;
        }
        break;

      case 'keyboardist':
        bodyRef.current.position.y = 1 + Math.sin(time * 1) * 0.02 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.4 + Math.sin(time * 5) * 0.15 * power;
          rightArmRef.current.rotation.z = -0.4 - Math.sin(time * 5 + 0.5) * 0.15 * power;
        }
        break;
    }
  });

  // Colors
  const shirtColor = '#1a1a1a';
  const pantsColor = '#000000';
  const skinColor = '#ffdbac';
  const instrumentColor = instrument === 'bassist' ? '#8b0000' : instrument === 'guitarist' ? '#ff4500' : '#1a1a2e';

  const faceExpression = animationState === 'playing' || animationState === 'solo' ? 
    (instrument === 'vocalist' ? 'singing' : 'intense') : 'neutral';

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.6, 8, 16]} />
        <meshStandardMaterial color={shirtColor} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Face */}
      <group position={[0, 1.5, 0]}>
        <FaceFeatures skinColor={skinColor} expression={faceExpression} />
      </group>

      {/* Hair */}
      <group position={[0, 1.5, 0]}>
        <CharacterHair hairType={hairType} color={hairColor} />
      </group>

      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-0.25, 1.2, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[0.25, 1.2, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.1, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>
      <mesh position={[0.1, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>

      {/* Instruments - Detailed 3D models */}
      {instrument === 'guitarist' && (
        <Instruments3D 
          type="electric-guitar" 
          color={instrumentColor}
          position={[0.15, 0.8, 0.1]} 
          rotation={[0, 0, -0.3]} 
        />
      )}

      {instrument === 'bassist' && (
        <Instruments3D 
          type="bass-guitar" 
          color={instrumentColor}
          position={[0.15, 0.8, 0.1]} 
          rotation={[0, 0, -0.3]} 
        />
      )}

      {instrument === 'drummer' && (
        <Instruments3D 
          type="drum-kit" 
          position={[0, 0, 1]} 
        />
      )}

      {instrument === 'vocalist' && (
        <Instruments3D 
          type="microphone" 
          position={[0, 0, 0]} 
        />
      )}

      {instrument === 'keyboardist' && (
        <Instruments3D 
          type="keyboard" 
          position={[0, 0.8, 0.3]} 
          rotation={[0, 0, 0]} 
        />
      )}
    </group>
  );
};
