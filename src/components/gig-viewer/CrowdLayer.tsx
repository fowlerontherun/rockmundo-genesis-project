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

  // Animate crowd based on mood
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    const intensity = crowdMood / 100;

    crowdData.forEach((person, i) => {
      const bobHeight = Math.sin(time * 2 + person.animOffset) * 0.2 * intensity;
      const sway = Math.sin(time + person.animOffset) * 0.1 * intensity;
      
      dummy.position.set(
        person.x + sway,
        0.8 + Math.abs(bobHeight),
        person.z
      );
      dummy.rotation.y = Math.sin(time * 0.5 + person.animOffset) * 0.2 * intensity;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, crowdData.length]} castShadow>
      <capsuleGeometry args={[0.2, 0.8, 4, 8]} />
      <meshStandardMaterial color="#2a2a3a" />
    </instancedMesh>
  );
};
