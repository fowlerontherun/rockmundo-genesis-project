import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";

interface CrowdLayerProps {
  crowdMood: number;
}

export const CrowdLayer = ({ crowdMood }: CrowdLayerProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  // Generate crowd positions
  const crowdData = useMemo(() => {
    const data = [];
    const rows = 10;
    const cols = 20;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = (col - cols / 2) * 0.6 + (Math.random() - 0.5) * 0.2;
        const z = row * 0.6 + 2 + (Math.random() - 0.5) * 0.2;
        const animOffset = Math.random() * Math.PI * 2;
        data.push({ x, z, animOffset });
      }
    }
    return data;
  }, []);

  // Animate crowd based on mood with distinct states
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    
    // Define crowd animation states based on mood
    let animationState: 'bored' | 'warming' | 'engaged' | 'energetic' | 'ecstatic';
    if (crowdMood < 20) animationState = 'bored';
    else if (crowdMood < 40) animationState = 'warming';
    else if (crowdMood < 60) animationState = 'engaged';
    else if (crowdMood < 80) animationState = 'energetic';
    else animationState = 'ecstatic';

    crowdData.forEach((person, i) => {
      let posY = 0.8;
      let sway = 0;
      let rotationY = 0;
      
      switch (animationState) {
        case 'bored':
          // Minimal movement, standing still
          posY = 0.8 + Math.sin(time * 0.5 + person.animOffset) * 0.02;
          sway = Math.sin(time * 0.3 + person.animOffset) * 0.02;
          break;
          
        case 'warming':
          // Light bobbing, starting to move
          posY = 0.8 + Math.sin(time * 1 + person.animOffset) * 0.08;
          sway = Math.sin(time * 0.5 + person.animOffset) * 0.05;
          rotationY = Math.sin(time * 0.4 + person.animOffset) * 0.1;
          break;
          
        case 'engaged':
          // Moderate bouncing, swaying to music
          posY = 0.8 + Math.abs(Math.sin(time * 1.5 + person.animOffset)) * 0.15;
          sway = Math.sin(time * 0.8 + person.animOffset) * 0.08;
          rotationY = Math.sin(time * 0.6 + person.animOffset) * 0.15;
          break;
          
        case 'energetic':
          // Active jumping, arms up motion
          posY = 0.8 + Math.abs(Math.sin(time * 2 + person.animOffset)) * 0.25;
          sway = Math.sin(time * 1.2 + person.animOffset) * 0.12;
          rotationY = Math.sin(time * 0.8 + person.animOffset) * 0.2;
          break;
          
        case 'ecstatic':
          // Wild jumping, maximum energy
          posY = 0.8 + Math.abs(Math.sin(time * 2.5 + person.animOffset)) * 0.35;
          sway = Math.sin(time * 1.5 + person.animOffset) * 0.15;
          rotationY = Math.sin(time + person.animOffset) * 0.3;
          break;
      }
      
      dummy.position.set(
        person.x + sway,
        posY,
        person.z
      );
      dummy.rotation.y = rotationY;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Dynamic emissive color based on mood state
  const getEmissiveColor = () => {
    if (crowdMood >= 80) return "#ff3300"; // Ecstatic - bright red-orange
    if (crowdMood >= 60) return "#ff6600"; // Energetic - orange
    if (crowdMood >= 40) return "#ffaa00"; // Engaged - yellow-orange
    if (crowdMood >= 20) return "#4444ff"; // Warming - blue
    return "#000000"; // Bored - no glow
  };

  const getEmissiveIntensity = () => {
    if (crowdMood >= 80) return 0.5;
    if (crowdMood >= 60) return 0.35;
    if (crowdMood >= 40) return 0.2;
    if (crowdMood >= 20) return 0.1;
    return 0;
  };

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, crowdData.length]} castShadow>
      <capsuleGeometry args={[0.2, 0.8, 4, 8]} />
      <meshStandardMaterial 
        color="#1a1a2e"
        emissive={getEmissiveColor()}
        emissiveIntensity={getEmissiveIntensity()}
      />
    </instancedMesh>
  );
};
