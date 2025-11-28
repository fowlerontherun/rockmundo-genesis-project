import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, SpotLight } from "three";

interface BandAvatarsProps {
  gigId?: string;
  bandId?: string;
  songProgress?: number;
  songSection?: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  bandMemberSkills?: Record<string, number>;
}

type AnimationState = 'intro' | 'playing' | 'outro';

export const BandAvatars = ({ 
  gigId,
  bandId,
  songProgress = 0,
  songSection = 'verse',
  bandMemberSkills = {}
}: BandAvatarsProps) => {
  const [animationState, setAnimationState] = useState<AnimationState>('playing');
  const spotlightRef = useRef<SpotLight>(null);
  
  useEffect(() => {
    if (songProgress < 0.1) {
      setAnimationState('intro');
    } else if (songProgress > 0.9) {
      setAnimationState('outro');
    } else {
      setAnimationState('playing');
    }
  }, [songProgress]);

  const guitarist1Ref = useRef<Mesh>(null);
  const guitarist2Ref = useRef<Mesh>(null);
  const bassistRef = useRef<Mesh>(null);
  const drummerRef = useRef<Mesh>(null);
  const vocalistRef = useRef<Mesh>(null);

  const getSectionIntensity = (section: string, memberPosition: string): number => {
    const baseIntensity = {
      'intro': 0.3,
      'verse': 0.6,
      'chorus': 1.0,
      'bridge': 0.7,
      'solo': 0.9,
      'outro': 0.5,
    }[section] || 0.6;

    const skillLevel = bandMemberSkills[memberPosition] || 50;
    const skillMultiplier = 0.7 + (skillLevel / 100) * 0.6;
    
    return baseIntensity * skillMultiplier;
  };

  const getSoloistRef = (section: string) => {
    if (section === 'solo') {
      return Math.random() > 0.5 ? guitarist1Ref : drummerRef;
    }
    return null;
  };

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const isSolo = songSection === 'solo';
    const soloistRef = getSoloistRef(songSection);

    if (guitarist1Ref.current) {
      const intensity = getSectionIntensity(songSection, 'guitarist1');
      const skillSpeed = 0.7 + (bandMemberSkills['guitarist1'] || 50) / 100 * 0.6;
      const baseY = 1;
      guitarist1Ref.current.position.y = baseY + Math.sin(time * 2 * intensity * skillSpeed) * 0.1 * intensity;
      guitarist1Ref.current.rotation.z = Math.sin(time * 1.5 * skillSpeed) * 0.05 * intensity;
      
      if (animationState === 'intro') {
        guitarist1Ref.current.position.y = baseY - 0.3;
      } else if (animationState === 'outro') {
        guitarist1Ref.current.position.y = baseY + Math.sin(time * 3) * 0.15;
      }
    }

    if (guitarist2Ref.current) {
      const intensity = getSectionIntensity(songSection, 'guitarist2');
      const skillSpeed = 0.7 + (bandMemberSkills['guitarist2'] || 50) / 100 * 0.6;
      const baseY = 1;
      guitarist2Ref.current.position.y = baseY + Math.cos(time * 2.2 * intensity * skillSpeed) * 0.1 * intensity;
      guitarist2Ref.current.rotation.z = Math.cos(time * 1.8 * skillSpeed) * 0.05 * intensity;
      
      if (animationState === 'intro') {
        guitarist2Ref.current.position.y = baseY - 0.3;
      } else if (animationState === 'outro') {
        guitarist2Ref.current.position.y = baseY + Math.cos(time * 3.2) * 0.15;
      }
    }

    if (bassistRef.current) {
      const intensity = getSectionIntensity(songSection, 'bassist');
      const skillSpeed = 0.7 + (bandMemberSkills['bassist'] || 50) / 100 * 0.6;
      const baseY = 1;
      bassistRef.current.position.y = baseY + Math.sin(time * 1.8 * intensity * skillSpeed) * 0.08 * intensity;
      bassistRef.current.rotation.y = Math.sin(time * 1.2 * skillSpeed) * 0.1 * intensity;
      
      if (animationState === 'intro') {
        bassistRef.current.position.y = baseY - 0.2;
      } else if (animationState === 'outro') {
        bassistRef.current.position.y = baseY + Math.sin(time * 2.5) * 0.12;
      }
    }

    if (drummerRef.current) {
      const intensity = getSectionIntensity(songSection, 'drummer');
      const skillSpeed = 0.7 + (bandMemberSkills['drummer'] || 50) / 100 * 0.6;
      const baseY = 1;
      const drumIntensity = intensity * 1.2;
      drummerRef.current.position.y = baseY + Math.sin(time * 4 * drumIntensity * skillSpeed) * 0.05 * drumIntensity;
      drummerRef.current.rotation.x = Math.sin(time * 3 * skillSpeed) * 0.03 * drumIntensity;
      
      if (animationState === 'intro') {
        drummerRef.current.position.y = baseY - 0.15;
      } else if (animationState === 'outro') {
        drummerRef.current.position.y = baseY + Math.sin(time * 5) * 0.08;
      }
    }

    if (vocalistRef.current) {
      const intensity = getSectionIntensity(songSection, 'vocalist');
      const skillSpeed = 0.7 + (bandMemberSkills['vocalist'] || 50) / 100 * 0.6;
      const baseY = 1.2;
      vocalistRef.current.position.y = baseY + Math.sin(time * 2.5 * intensity * skillSpeed) * 0.12 * intensity;
      vocalistRef.current.rotation.z = Math.sin(time * 1.3 * skillSpeed) * 0.08 * intensity;
      vocalistRef.current.position.x = Math.sin(time * 0.8 * skillSpeed) * 0.3 * intensity;
      
      if (animationState === 'intro') {
        vocalistRef.current.position.y = baseY - 0.4;
        vocalistRef.current.rotation.y = Math.sin(time) * 0.2;
      } else if (animationState === 'outro') {
        vocalistRef.current.position.y = baseY + Math.sin(time * 3.5) * 0.2;
        vocalistRef.current.rotation.y = Math.sin(time * 2) * 0.3;
      }
    }

    if (spotlightRef.current && soloistRef?.current) {
      spotlightRef.current.target.position.copy(soloistRef.current.position);
      spotlightRef.current.intensity = 5 + Math.sin(time * 3) * 1;
    } else if (spotlightRef.current) {
      spotlightRef.current.intensity = 0;
    }
  });

  return (
    <>
      <group position={[0, 0, -5]}>
        <mesh ref={guitarist1Ref} position={[-2, 1, 1]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial color="#ff6b35" emissive="#ff6b35" emissiveIntensity={0.2} />
        </mesh>

        <mesh ref={guitarist2Ref} position={[2, 1, 1]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial color="#004e89" emissive="#004e89" emissiveIntensity={0.2} />
        </mesh>

        <mesh ref={bassistRef} position={[-4, 1, 0.5]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial color="#00a878" emissive="#00a878" emissiveIntensity={0.2} />
        </mesh>

        <mesh ref={drummerRef} position={[0, 1, -1]} castShadow>
          <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
          <meshStandardMaterial color="#f95738" emissive="#f95738" emissiveIntensity={0.2} />
        </mesh>

        <mesh ref={vocalistRef} position={[0, 1.2, 2]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={0.3} />
        </mesh>

        <mesh position={[0, 1, -1.5]} castShadow>
          <cylinderGeometry args={[0.4, 0.5, 0.3, 16]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      </group>

      <spotLight
        ref={spotlightRef}
        position={[0, 10, 0]}
        angle={0.4}
        penumbra={0.2}
        intensity={0}
        color="#ffffff"
        castShadow
      />
    </>
  );
};
