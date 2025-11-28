import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, SpotLight } from "three";

interface BandAvatarsProps {
  gigId: string;
  songProgress?: number; // 0-1, represents song progression
  songSection?: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
}

type AnimationState = 'intro' | 'playing' | 'outro';

export const BandAvatars = ({ 
  gigId, 
  songProgress = 0.5,
  songSection = 'chorus'
}: BandAvatarsProps) => {
  const [animationState, setAnimationState] = useState<AnimationState>('playing');
  const spotlightRef = useRef<SpotLight>(null);
  
  // Determine animation state based on song progress
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

  // Get intensity multiplier based on song section
  const getSectionIntensity = () => {
    switch (songSection) {
      case 'intro':
        return 0.4;
      case 'verse':
        return 0.6;
      case 'chorus':
        return 1.2;
      case 'bridge':
        return 0.8;
      case 'solo':
        return 1.0;
      case 'outro':
        return 0.5;
      default:
        return 1.0;
    }
  };

  // Determine who gets spotlight during solo
  const getSoloistRef = () => {
    if (songSection === 'solo') {
      // Alternate between lead guitarist and drummer
      return Math.random() > 0.5 ? guitarist1Ref : drummerRef;
    }
    return null;
  };

  // Animation for band members based on state and section
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    let baseIntensity = 1.0;
    let speed = 1.0;
    
    switch (animationState) {
      case 'intro':
        baseIntensity = 0.5;
        speed = 0.8;
        break;
      case 'playing':
        baseIntensity = 1.0;
        speed = 1.0;
        break;
      case 'outro':
        baseIntensity = 0.7;
        speed = 0.6;
        break;
    }

    const sectionIntensity = getSectionIntensity();
    const intensity = baseIntensity * sectionIntensity;
    const soloistRef = getSoloistRef();

    // Lead Guitarist - energetic, moves with the music
    if (guitarist1Ref.current) {
      const isSoloist = soloistRef === guitarist1Ref;
      const soloBoost = isSoloist ? 1.5 : (songSection === 'solo' ? 0.6 : 1.0);
      
      const bobAmount = 0.1 * intensity * soloBoost;
      const swayAmount = 0.05 * intensity * soloBoost;
      
      guitarist1Ref.current.position.y = 1.3 + Math.sin(time * 2 * speed) * bobAmount;
      guitarist1Ref.current.rotation.z = Math.sin(time * speed) * swayAmount;
      
      if (songSection === 'chorus' || isSoloist) {
        guitarist1Ref.current.rotation.y = Math.sin(time * 0.8) * 0.15;
      }
    }

    // Rhythm Guitarist - steadier, support role
    if (guitarist2Ref.current) {
      const supportFactor = songSection === 'solo' ? 0.6 : 1.0;
      const bobAmount = 0.08 * intensity * supportFactor;
      const swayAmount = 0.04 * intensity * supportFactor;
      
      guitarist2Ref.current.position.y = 1.3 + Math.sin(time * 2 * speed + 1) * bobAmount;
      guitarist2Ref.current.rotation.z = Math.sin(time * speed + 1) * swayAmount;
    }

    // Bassist - groovy, bounces to the beat
    if (bassistRef.current) {
      const supportFactor = songSection === 'solo' ? 0.6 : 1.0;
      const bounceAmount = 0.12 * intensity * supportFactor;
      
      bassistRef.current.position.y = 1.3 + Math.abs(Math.sin(time * 1.5 * speed)) * bounceAmount;
      
      if (songSection === 'chorus') {
        bassistRef.current.rotation.x = Math.sin(time * 2) * 0.15;
      }
    }

    // Drummer - focused, upper body motion
    if (drummerRef.current) {
      const isSoloist = soloistRef === drummerRef;
      const soloBoost = isSoloist ? 1.8 : 1.0;
      
      drummerRef.current.rotation.y = Math.sin(time * speed * 0.5) * 0.1;
      
      if (songSection === 'chorus' || isSoloist) {
        drummerRef.current.position.y = 1.5 + Math.abs(Math.sin(time * 4 * soloBoost)) * 0.08;
      }
    }

    // Vocalist - expressive, front and center
    if (vocalistRef.current) {
      const expressiveMove = 0.15 * intensity;
      vocalistRef.current.position.y = 1.3 + Math.sin(time * 1.8 * speed) * expressiveMove;
      
      if (songSection === 'chorus') {
        vocalistRef.current.rotation.z = Math.sin(time * 0.8) * 0.15;
        vocalistRef.current.position.x = Math.sin(time * 0.4) * 0.15;
      } else if (songSection === 'bridge') {
        vocalistRef.current.rotation.y = Math.sin(time * 0.6) * 0.1;
      }
    }

    // Spotlight on soloist during solo section
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
        {/* Lead Guitarist */}
        <mesh ref={guitarist1Ref} position={[-2, 1.3, 1]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial 
            color="#ff0066"
            emissive="#ff0066"
            emissiveIntensity={0.3}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>

        {/* Rhythm Guitarist */}
        <mesh ref={guitarist2Ref} position={[2, 1.3, 1]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial 
            color="#0066ff"
            emissive="#0066ff"
            emissiveIntensity={0.3}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>

        {/* Bassist */}
        <mesh ref={bassistRef} position={[-4, 1.3, 0.5]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial 
            color="#00ff66"
            emissive="#00ff66"
            emissiveIntensity={0.3}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>

        {/* Drummer */}
        <mesh ref={drummerRef} position={[0, 1.5, -1]} castShadow>
          <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
          <meshStandardMaterial 
            color="#ffff00"
            emissive="#ffff00"
            emissiveIntensity={0.3}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>

        {/* Vocalist - center stage */}
        <mesh ref={vocalistRef} position={[0, 1.3, 2]} castShadow>
          <capsuleGeometry args={[0.3, 1, 4, 8]} />
          <meshStandardMaterial 
            color="#ff00ff"
            emissive="#ff00ff"
            emissiveIntensity={0.4}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>

        {/* Simple drum kit representation */}
        <mesh position={[0, 1, -1.5]} castShadow>
          <cylinderGeometry args={[0.4, 0.5, 0.3, 16]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      </group>

      {/* Solo spotlight */}
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
