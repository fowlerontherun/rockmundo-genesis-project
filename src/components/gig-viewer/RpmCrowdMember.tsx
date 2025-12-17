import { Suspense, useMemo } from "react";
import { ReadyPlayerMeAvatar } from "../avatar-system/ReadyPlayerMeAvatar";

interface RpmCrowdMemberProps {
  position: [number, number, number];
  avatarUrl: string;
  scale?: number;
  stageZ?: number;
}

// Simple loading placeholder for crowd member
const CrowdPlaceholder = ({ scale = 1 }: { scale?: number }) => (
  <mesh scale={scale}>
    <capsuleGeometry args={[0.15, 0.5, 4, 8]} />
    <meshBasicMaterial color="#333333" transparent opacity={0.5} />
  </mesh>
);

export const RpmCrowdMember = ({ 
  position, 
  avatarUrl, 
  scale = 1,
  stageZ = -5 
}: RpmCrowdMemberProps) => {
  // Calculate rotation to face the stage
  const rotationY = useMemo(() => {
    const [x, , z] = position;
    return Math.atan2(x, z - stageZ);
  }, [position, stageZ]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Suspense fallback={<CrowdPlaceholder scale={1} />}>
        <ReadyPlayerMeAvatar
          avatarUrl={avatarUrl}
          scale={1}
          position={[0, 0, 0]}
          animation="idle"
        />
      </Suspense>
    </group>
  );
};
