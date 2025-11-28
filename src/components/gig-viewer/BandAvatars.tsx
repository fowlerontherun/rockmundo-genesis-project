import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import { SpotLight } from "three";
import * as THREE from "three";

// Import band member sprites
import leadGuitarSprite from "@/assets/band-lead-guitar.png";
import bassistSprite from "@/assets/band-bassist.png";
import drummerSprite from "@/assets/band-drummer.png";
import vocalistSprite from "@/assets/band-vocalist.png";
import rhythmGuitarSprite from "@/assets/band-rhythm-guitar.png";

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
  
  // Load band member textures
  const bandTextures = useTexture({
    guitarist1: leadGuitarSprite,
    guitarist2: rhythmGuitarSprite,
    bassist: bassistSprite,
    drummer: drummerSprite,
    vocalist: vocalistSprite
  });

  // Configure textures for pixel-perfect rendering
  Object.values(bandTextures).forEach(texture => {
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
  });

  // Custom shader for green-screen color-keying (removes #00FF00 background)
  const onBeforeCompile = (shader: any) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      
      // Precise green-screen color-keying for #00FF00 bright green
      vec3 green = vec3(0.0, 1.0, 0.0);
      float greenDist = distance(diffuseColor.rgb, green);
      
      // Discard pixels that are close to pure green
      if (greenDist < 0.4) {
        discard;
      }
      
      // Also discard very bright greens
      float greenDiff = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
      if (greenDiff > 0.3 && diffuseColor.g > 0.7) {
        discard;
      }
      
      // Remove shadows on green background
      if (diffuseColor.g > 0.5 && diffuseColor.r < 0.3 && diffuseColor.b < 0.3) {
        discard;
      }
      `
    );
  };
  
  useEffect(() => {
    if (songProgress < 0.1) {
      setAnimationState('intro');
    } else if (songProgress > 0.9) {
      setAnimationState('outro');
    } else {
      setAnimationState('playing');
    }
  }, [songProgress]);

  const guitarist1Ref = useRef<THREE.Mesh>(null);
  const guitarist2Ref = useRef<THREE.Mesh>(null);
  const bassistRef = useRef<THREE.Mesh>(null);
  const drummerRef = useRef<THREE.Mesh>(null);
  const vocalistRef = useRef<THREE.Mesh>(null);

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

    // Animate band members with larger, more visible movements
    if (guitarist1Ref.current) {
      const intensity = getSectionIntensity(songSection, 'guitarist1');
      const skillSpeed = 0.7 + (bandMemberSkills['guitarist1'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.sin(time * 2 * intensity * skillSpeed) * 0.08 * intensity;
      guitarist1Ref.current.scale.set(scaleVariation, scaleVariation, 1);
      guitarist1Ref.current.rotation.z = Math.sin(time * 1.5 * skillSpeed) * 0.05 * intensity;
      
      if (animationState === 'intro') {
        guitarist1Ref.current.scale.set(0.8, 0.8, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 3) * 0.12;
        guitarist1Ref.current.scale.set(bounce, bounce, 1);
      }
    }

    if (guitarist2Ref.current) {
      const intensity = getSectionIntensity(songSection, 'guitarist2');
      const skillSpeed = 0.7 + (bandMemberSkills['guitarist2'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.cos(time * 2.2 * intensity * skillSpeed) * 0.08 * intensity;
      guitarist2Ref.current.scale.set(scaleVariation, scaleVariation, 1);
      guitarist2Ref.current.rotation.z = Math.cos(time * 1.8 * skillSpeed) * 0.05 * intensity;
      
      if (animationState === 'intro') {
        guitarist2Ref.current.scale.set(0.8, 0.8, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.cos(time * 3.2) * 0.12;
        guitarist2Ref.current.scale.set(bounce, bounce, 1);
      }
    }

    if (bassistRef.current) {
      const intensity = getSectionIntensity(songSection, 'bassist');
      const skillSpeed = 0.7 + (bandMemberSkills['bassist'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.sin(time * 1.8 * intensity * skillSpeed) * 0.07 * intensity;
      bassistRef.current.scale.set(scaleVariation, scaleVariation, 1);
      bassistRef.current.rotation.z = Math.sin(time * 1.2 * skillSpeed) * 0.04 * intensity;
      
      if (animationState === 'intro') {
        bassistRef.current.scale.set(0.85, 0.85, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 2.5) * 0.1;
        bassistRef.current.scale.set(bounce, bounce, 1);
      }
    }

    if (drummerRef.current) {
      const intensity = getSectionIntensity(songSection, 'drummer');
      const skillSpeed = 0.7 + (bandMemberSkills['drummer'] || 50) / 100 * 0.6;
      const drumIntensity = intensity * 1.2;
      
      const scaleVariation = 1 + Math.sin(time * 4 * drumIntensity * skillSpeed) * 0.06 * drumIntensity;
      drummerRef.current.scale.set(scaleVariation, scaleVariation, 1);
      drummerRef.current.rotation.x = Math.sin(time * 3 * skillSpeed) * 0.03 * drumIntensity;
      
      if (animationState === 'intro') {
        drummerRef.current.scale.set(0.9, 0.9, 1);
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 5) * 0.08;
        drummerRef.current.scale.set(bounce, bounce, 1);
      }
    }

    if (vocalistRef.current) {
      const intensity = getSectionIntensity(songSection, 'vocalist');
      const skillSpeed = 0.7 + (bandMemberSkills['vocalist'] || 50) / 100 * 0.6;
      
      const scaleVariation = 1 + Math.sin(time * 2.5 * intensity * skillSpeed) * 0.09 * intensity;
      vocalistRef.current.scale.set(scaleVariation, scaleVariation, 1);
      vocalistRef.current.rotation.z = Math.sin(time * 1.3 * skillSpeed) * 0.06 * intensity;
      
      if (animationState === 'intro') {
        vocalistRef.current.scale.set(0.7, 0.7, 1);
        vocalistRef.current.rotation.z = Math.sin(time) * 0.1;
      } else if (animationState === 'outro') {
        const bounce = 1 + Math.sin(time * 3.5) * 0.15;
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
      {/* Lead Guitarist */}
      <Billboard position={[-3, 2, -6]}>
        <mesh ref={guitarist1Ref}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshStandardMaterial 
            map={bandTextures.guitarist1}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            emissive="#ffffff"
            emissiveIntensity={0.1}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
      </Billboard>

      {/* Rhythm Guitarist */}
      <Billboard position={[3, 2, -6]}>
        <mesh ref={guitarist2Ref}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshStandardMaterial 
            map={bandTextures.guitarist2}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            emissive="#ffffff"
            emissiveIntensity={0.1}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
      </Billboard>

      {/* Bassist */}
      <Billboard position={[-1.5, 2, -5.5]}>
        <mesh ref={bassistRef}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshStandardMaterial 
            map={bandTextures.bassist}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            emissive="#ffffff"
            emissiveIntensity={0.1}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
      </Billboard>

      {/* Drummer */}
      <Billboard position={[0, 2.5, -8]}>
        <mesh ref={drummerRef}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshStandardMaterial 
            map={bandTextures.drummer}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            emissive="#ffffff"
            emissiveIntensity={0.1}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
      </Billboard>

      {/* Vocalist */}
      <Billboard position={[1.5, 2, -4]}>
        <mesh ref={vocalistRef}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshStandardMaterial 
            map={bandTextures.vocalist}
            transparent
            alphaTest={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            emissive="#ffffff"
            emissiveIntensity={0.1}
            onBeforeCompile={onBeforeCompile}
          />
        </mesh>
      </Billboard>

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
