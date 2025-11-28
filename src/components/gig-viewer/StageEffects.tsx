import { useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Points, PointsMaterial, Sprite, SpriteMaterial, TextureLoader } from "three";
import * as THREE from "three";
import lightBeamTexture from "@/assets/light-beam.png";
import stageHazeTexture from "@/assets/stage-haze.png";

interface StageEffectsProps {
  crowdMood: number;
  songIntensity?: number;
  songSection?: string;
}

export const StageEffects = ({ 
  crowdMood, 
  songIntensity = 1.0,
  songSection = 'verse'
}: StageEffectsProps) => {
  const particlesRef = useRef<Points>(null);
  const lightBeam1Ref = useRef<Sprite>(null);
  const lightBeam2Ref = useRef<Sprite>(null);
  const lightBeam3Ref = useRef<Sprite>(null);
  const lightBeam4Ref = useRef<Sprite>(null);
  const hazeLayer1Ref = useRef<Sprite>(null);
  const hazeLayer2Ref = useRef<Sprite>(null);
  const hazeLayer3Ref = useRef<Sprite>(null);

  // Load effect textures
  const [beamTex, hazeTex] = useLoader(TextureLoader, [
    lightBeamTexture,
    stageHazeTexture
  ]);

  // Configure textures
  beamTex.magFilter = THREE.LinearFilter;
  beamTex.minFilter = THREE.LinearFilter;
  hazeTex.magFilter = THREE.LinearFilter;
  hazeTex.minFilter = THREE.LinearFilter;

  // Create particle positions for atmospheric particles
  const particleCount = 400;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18; // x
      pos[i * 3 + 1] = Math.random() * 7; // y
      pos[i * 3 + 2] = -10 + Math.random() * 12; // z
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const intensity = (crowdMood / 100) * songIntensity;

    // Animate atmospheric particles
    if (particlesRef.current) {
      const geometry = particlesRef.current.geometry;
      const positions = geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Gentle upward drift
        positions[i3 + 1] += 0.008;
        // Sideways drift
        positions[i3] += Math.sin(time * 0.5 + i) * 0.002;
        positions[i3 + 2] += Math.cos(time * 0.3 + i) * 0.002;

        // Reset particle if it goes too high
        if (positions[i3 + 1] > 8) {
          positions[i3 + 1] = 0;
          positions[i3] = (Math.random() - 0.5) * 18;
          positions[i3 + 2] = -10 + Math.random() * 12;
        }
      }

      geometry.attributes.position.needsUpdate = true;

      // Fade particles based on mood and intensity
      const material = particlesRef.current.material as PointsMaterial;
      material.opacity = 0.15 + intensity * 0.25;
    }

    // Get color based on section
    const getSectionColor = () => {
      if (songSection === 'chorus' || songSection === 'bigChorus') {
        return new THREE.Color('#ff3366');
      } else if (songSection === 'bridge') {
        return new THREE.Color('#00ffff');
      } else if (songSection === 'intro' || songSection === 'outro') {
        return new THREE.Color('#6600ff');
      }
      return new THREE.Color('#ff00ff');
    };

    const sectionColor = getSectionColor();

    // Animate volumetric light beams
    if (lightBeam1Ref.current) {
      const material = lightBeam1Ref.current.material as SpriteMaterial;
      material.opacity = 0.3 + Math.sin(time * 2) * intensity * 0.3;
      material.color = sectionColor;
      lightBeam1Ref.current.position.x = -4 + Math.sin(time * 0.8) * 2;
      lightBeam1Ref.current.scale.set(3, 8, 1);
    }

    if (lightBeam2Ref.current) {
      const material = lightBeam2Ref.current.material as SpriteMaterial;
      material.opacity = 0.3 + Math.cos(time * 2.5) * intensity * 0.3;
      material.color = new THREE.Color('#00ffff');
      lightBeam2Ref.current.position.x = 4 + Math.cos(time * 0.7) * 2;
      lightBeam2Ref.current.scale.set(3, 8, 1);
    }

    if (lightBeam3Ref.current) {
      const material = lightBeam3Ref.current.material as SpriteMaterial;
      material.opacity = 0.25 + Math.sin(time * 3) * intensity * 0.25;
      material.color = new THREE.Color('#ffff00');
      lightBeam3Ref.current.position.x = Math.sin(time * 1.2) * 3;
      lightBeam3Ref.current.scale.set(2.5, 7, 1);
    }

    if (lightBeam4Ref.current) {
      const material = lightBeam4Ref.current.material as SpriteMaterial;
      material.opacity = 0.25 + Math.cos(time * 2.8) * intensity * 0.25;
      material.color = new THREE.Color('#ff6600');
      lightBeam4Ref.current.position.x = Math.cos(time * 1.1) * 3;
      lightBeam4Ref.current.scale.set(2.5, 7, 1);
    }

    // Animate haze layers
    if (hazeLayer1Ref.current) {
      const material = hazeLayer1Ref.current.material as SpriteMaterial;
      material.opacity = 0.2 + intensity * 0.15;
      hazeLayer1Ref.current.position.x = Math.sin(time * 0.2) * 2;
    }

    if (hazeLayer2Ref.current) {
      const material = hazeLayer2Ref.current.material as SpriteMaterial;
      material.opacity = 0.25 + intensity * 0.2;
      hazeLayer2Ref.current.position.x = Math.cos(time * 0.15) * 2;
    }

    if (hazeLayer3Ref.current) {
      const material = hazeLayer3Ref.current.material as SpriteMaterial;
      material.opacity = 0.15 + intensity * 0.1;
      hazeLayer3Ref.current.position.x = Math.sin(time * 0.25) * 1.5;
    }
  });

  return (
    <group>
      {/* Atmospheric particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          color="#ffffff"
          transparent
          opacity={0.2}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Volumetric light beams */}
      <sprite ref={lightBeam1Ref} position={[-4, 4, -6]}>
        <spriteMaterial
          map={beamTex}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <sprite ref={lightBeam2Ref} position={[4, 4, -6]}>
        <spriteMaterial
          map={beamTex}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <sprite ref={lightBeam3Ref} position={[0, 4, -5]}>
        <spriteMaterial
          map={beamTex}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <sprite ref={lightBeam4Ref} position={[0, 4, -7]}>
        <spriteMaterial
          map={beamTex}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Haze layers */}
      <sprite ref={hazeLayer1Ref} position={[0, 1, -5]} scale={[20, 4, 1]}>
        <spriteMaterial
          map={hazeTex}
          transparent
          opacity={0.25}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </sprite>

      <sprite ref={hazeLayer2Ref} position={[0, 2.5, -6]} scale={[18, 3, 1]}>
        <spriteMaterial
          map={hazeTex}
          transparent
          opacity={0.3}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </sprite>

      <sprite ref={hazeLayer3Ref} position={[0, 0.5, -4]} scale={[22, 2, 1]}>
        <spriteMaterial
          map={hazeTex}
          transparent
          opacity={0.2}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
};
