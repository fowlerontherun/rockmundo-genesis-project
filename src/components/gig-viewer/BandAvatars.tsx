import { useRef, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Mesh, SpotLight, TextureLoader } from "three";
import { Billboard } from "./Billboard";
import leadGuitaristTexture from "@/assets/textures/avatars/band-lead-guitarist.png";
import rhythmGuitaristTexture from "@/assets/textures/avatars/band-rhythm-guitarist.png";
import bassistTexture from "@/assets/textures/avatars/band-bassist.png";
import drummerTexture from "@/assets/textures/avatars/band-drummer.png";
import vocalistTexture from "@/assets/textures/avatars/band-vocalist.png";

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
  
  // Load realistic textures
  const leadGuitarTexture = useLoader(TextureLoader, leadGuitaristTexture);
  const rhythmGuitarTexture = useLoader(TextureLoader, rhythmGuitaristTexture);
  const bassTexture = useLoader(TextureLoader, bassistTexture);
  const drumTexture = useLoader(TextureLoader, drummerTexture);
  const vocalTexture = useLoader(TextureLoader, vocalistTexture);
  
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
    const soloistRef = getSoloistRef(songSection);

    // Simplified animations for billboard sprites - focus on scale and subtle rotation
    if (guitarist1Ref.current) {
      const intensity = getSectionIntensity(songSection, 'guitarist1');
      const skillSpeed = 0.7 + (bandMemberSkills['guitarist1'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.sin(time * 2 * intensity * skillSpeed) * 0.05 * intensity;
      guitarist1Ref.current.scale.set(scaleVariation, scaleVariation, 1);
      guitarist1Ref.current.rotation.z = Math.sin(time * 1.5 * skillSpeed) * 0.03 * intensity;
      
      if (animationState === 'intro') {
        guitarist1Ref.current.scale.set(0.8, 0.8, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 3) * 0.1;
        guitarist1Ref.current.scale.set(bounce, bounce, 1);
      }
    }

    if (guitarist2Ref.current) {
      const intensity = getSectionIntensity(songSection, 'guitarist2');
      const skillSpeed = 0.7 + (bandMemberSkills['guitarist2'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.cos(time * 2.2 * intensity * skillSpeed) * 0.05 * intensity;
      guitarist2Ref.current.scale.set(scaleVariation, scaleVariation, 1);
      guitarist2Ref.current.rotation.z = Math.cos(time * 1.8 * skillSpeed) * 0.03 * intensity;
      
      if (animationState === 'intro') {
        guitarist2Ref.current.scale.set(0.8, 0.8, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.cos(time * 3.2) * 0.1;
        guitarist2Ref.current.scale.set(bounce, bounce, 1);
      }
    }

    if (bassistRef.current) {
      const intensity = getSectionIntensity(songSection, 'bassist');
      const skillSpeed = 0.7 + (bandMemberSkills['bassist'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.sin(time * 1.8 * intensity * skillSpeed) * 0.04 * intensity;
      bassistRef.current.scale.set(scaleVariation, scaleVariation, 1);
      bassistRef.current.rotation.z = Math.sin(time * 1.2 * skillSpeed) * 0.02 * intensity;
      
      if (animationState === 'intro') {
        bassistRef.current.scale.set(0.85, 0.85, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 2.5) * 0.08;
        bassistRef.current.scale.set(bounce, bounce, 1);
      }
    }

    if (drummerRef.current) {
      const intensity = getSectionIntensity(songSection, 'drummer');
      const skillSpeed = 0.7 + (bandMemberSkills['drummer'] || 50) / 100 * 0.6;
      const drumIntensity = intensity * 1.2;
      
      const scaleVariation = 1 + Math.sin(time * 4 * drumIntensity * skillSpeed) * 0.03 * drumIntensity;
      drummerRef.current.scale.set(scaleVariation, scaleVariation, 1);
      drummerRef.current.rotation.x = Math.sin(time * 3 * skillSpeed) * 0.02 * drumIntensity;
      
      if (animationState === 'intro') {
        drummerRef.current.scale.set(0.9, 0.9, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 5) * 0.06;
        drummerRef.current.scale.set(bounce, bounce, 1);
      }
    }

    if (vocalistRef.current) {
      const intensity = getSectionIntensity(songSection, 'vocalist');
      const skillSpeed = 0.7 + (bandMemberSkills['vocalist'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.sin(time * 2.5 * intensity * skillSpeed) * 0.06 * intensity;
      vocalistRef.current.scale.set(scaleVariation, scaleVariation, 1);
      vocalistRef.current.rotation.z = Math.sin(time * 1.3 * skillSpeed) * 0.04 * intensity;
      
      if (animationState === 'intro') {
        vocalistRef.current.scale.set(0.7, 0.7, 1);
        vocalistRef.current.rotation.z = Math.sin(time) * 0.1;
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 3.5) * 0.12;
        vocalistRef.current.scale.set(bounce, bounce, 1);
        vocalistRef.current.rotation.z = Math.sin(time * 2) * 0.15;
      }
    }

    // Solo spotlight effect
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
        {/* Lead Guitarist - Billboard sprite */}
        <Billboard position={[-2, 0, 1]}>
          <mesh ref={guitarist1Ref} castShadow>
            <planeGeometry args={[1.2, 2.4]} />
            <meshStandardMaterial 
              map={leadGuitarTexture}
              transparent
              alphaTest={0.1}
              emissive="#ff6b35" 
              emissiveIntensity={0.15}
            />
          </mesh>
        </Billboard>

        {/* Rhythm Guitarist - Billboard sprite */}
        <Billboard position={[2, 0, 1]}>
          <mesh ref={guitarist2Ref} castShadow>
            <planeGeometry args={[1.2, 2.4]} />
            <meshStandardMaterial 
              map={rhythmGuitarTexture}
              transparent
              alphaTest={0.1}
              emissive="#004e89" 
              emissiveIntensity={0.15}
            />
          </mesh>
        </Billboard>

        {/* Bassist - Billboard sprite */}
        <Billboard position={[-4, 0, 0.5]}>
          <mesh ref={bassistRef} castShadow>
            <planeGeometry args={[1.2, 2.4]} />
            <meshStandardMaterial 
              map={bassTexture}
              transparent
              alphaTest={0.1}
              emissive="#00a878" 
              emissiveIntensity={0.15}
            />
          </mesh>
        </Billboard>

        {/* Drummer - Billboard sprite (larger for visibility) */}
        <Billboard position={[0, 0.2, -1]}>
          <mesh ref={drummerRef} castShadow>
            <planeGeometry args={[1.5, 2.0]} />
            <meshStandardMaterial 
              map={drumTexture}
              transparent
              alphaTest={0.1}
              emissive="#f95738" 
              emissiveIntensity={0.15}
            />
          </mesh>
        </Billboard>

        {/* Vocalist - Billboard sprite */}
        <Billboard position={[0, 0, 2]}>
          <mesh ref={vocalistRef} castShadow>
            <planeGeometry args={[1.2, 2.4]} />
            <meshStandardMaterial 
              map={vocalTexture}
              transparent
              alphaTest={0.1}
              emissive="#ff00ff" 
              emissiveIntensity={0.2}
            />
          </mesh>
        </Billboard>

        {/* Drum kit base (optional accent) */}
        <mesh position={[0, 0.5, -1.2]} castShadow>
          <cylinderGeometry args={[0.6, 0.7, 0.4, 16]} />
          <meshStandardMaterial 
            color="#1a1a1a" 
            metalness={0.6}
            roughness={0.3}
          />
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
