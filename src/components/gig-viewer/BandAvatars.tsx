import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface BandAvatarsProps {
  gigId: string;
  songProgress?: number; // 0-1, represents song progression
}

type AnimationState = 'intro' | 'playing' | 'outro';

export const BandAvatars = ({ gigId, songProgress = 0.5 }: BandAvatarsProps) => {
  const [animationState, setAnimationState] = useState<AnimationState>('playing');
  
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

  // Animation for band members based on state
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    let intensity = 1.0;
    let speed = 1.0;
    
    switch (animationState) {
      case 'intro':
        // Calm, building anticipation
        intensity = 0.5;
        speed = 0.8;
        break;
      case 'playing':
        // Full energy performance
        intensity = 1.0;
        speed = 1.0;
        break;
      case 'outro':
        // Winding down
        intensity = 0.7;
        speed = 0.6;
        break;
    }

    // Lead Guitarist - energetic, moves with the music
    if (guitarist1Ref.current) {
      const bobAmount = 0.1 * intensity;
      const swayAmount = 0.05 * intensity;
      guitarist1Ref.current.position.y = 1.3 + Math.sin(time * 2 * speed) * bobAmount;
      guitarist1Ref.current.rotation.z = Math.sin(time * speed) * swayAmount;
      
      if (animationState === 'playing') {
        // Extra motion during main performance
        guitarist1Ref.current.rotation.y = Math.sin(time * 0.5) * 0.1;
      }
    }

    // Rhythm Guitarist - steadier, support role
    if (guitarist2Ref.current) {
      const bobAmount = 0.08 * intensity;
      const swayAmount = 0.04 * intensity;
      guitarist2Ref.current.position.y = 1.3 + Math.sin(time * 2 * speed + 1) * bobAmount;
      guitarist2Ref.current.rotation.z = Math.sin(time * speed + 1) * swayAmount;
    }

    // Bassist - groovy, bounces to the beat
    if (bassistRef.current) {
      const bounceAmount = 0.12 * intensity;
      bassistRef.current.position.y = 1.3 + Math.abs(Math.sin(time * 1.5 * speed)) * bounceAmount;
      
      if (animationState === 'playing') {
        // Head bang motion
        bassistRef.current.rotation.x = Math.sin(time * 2) * 0.15;
      }
    }

    // Drummer - focused, upper body motion
    if (drummerRef.current) {
      drummerRef.current.rotation.y = Math.sin(time * speed * 0.5) * 0.1;
      
      if (animationState === 'playing') {
        // Drumming motion - faster movements
        drummerRef.current.position.y = 1.5 + Math.abs(Math.sin(time * 4)) * 0.05;
      }
    }

    // Vocalist - expressive, front and center
    if (vocalistRef.current) {
      const expressiveMove = 0.15 * intensity;
      vocalistRef.current.position.y = 1.3 + Math.sin(time * 1.8 * speed) * expressiveMove;
      
      if (animationState === 'playing') {
        // Microphone hand raise motion
        vocalistRef.current.rotation.z = Math.sin(time * 0.8) * 0.1;
        vocalistRef.current.position.x = Math.sin(time * 0.4) * 0.1;
      }
    }
  });

  return (
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
  );
};
