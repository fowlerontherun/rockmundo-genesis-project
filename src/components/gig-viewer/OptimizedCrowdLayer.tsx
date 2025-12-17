import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RpmCrowdMember } from "./RpmCrowdMember";
import { RPM_DEMO_AVATAR } from "@/data/rpmAvatarPool";

interface OptimizedCrowdLayerProps {
  crowdMood: number;
  bandFame: number;
  bandMerchColor: string;
  bandName?: string;
  maxCrowdCount: number;
  densityMultiplier: number;
  /** Demo helper: render the entire crowd as RPM avatars (heavier). */
  useRpmCrowd?: boolean;
}

interface CrowdPerson {
  id: number;
  position: [number, number, number];
  seed: number;
  colorVariant: number;
  showMerch: boolean;
  scale: number;
  baseY: number;
  hairType: number;
  gender: number;
  accessory: number;
  rotationY: number; // Rotation to face stage
}

// Seeded random number generator for deterministic positions
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Enhanced color palettes with more variety
const shirtColors = [
  '#1a1a1a', '#2d2d2d', '#4a4a4a', '#333333', // Dark
  '#ff3333', '#cc2222', '#990000', // Reds
  '#3333ff', '#2222cc', '#000099', // Blues
  '#33ff33', '#22cc22', // Greens
  '#ff6600', '#cc5500', // Orange
  '#9933ff', '#6600cc', // Purple
  '#ffcc00', '#ff9900', // Yellow/Gold
  '#00cccc', '#006666', // Teal
  '#ff66cc', '#cc3399', // Pink
];

const pantsColors = ['#1a1a1a', '#2d2d2d', '#0066cc', '#4a4a4a', '#000044', '#1a0a0a', '#333344'];

const skinTones = [
  '#8d5524', '#a5673f', '#c68642', '#d4956a',
  '#e0ac69', '#eac086', '#f1c27d', '#f5d7b2', '#ffdbac', '#ffe4c4'
];

const hairColors = [
  '#1a1a1a', '#2d2314', '#3d2616', '#4a3728', 
  '#8b4513', '#a0522d', '#b87333', '#cd853f',
  '#daa520', '#e6be8a', '#f5deb3', '#ffebcd',
  '#800000', '#a52a2a', '#b22222', // Red hair
  '#4b0082', '#8b008b', // Dyed hair
];

export const OptimizedCrowdLayer = ({
  crowdMood,
  bandFame,
  bandMerchColor,
  bandName = "BAND",
  maxCrowdCount,
  densityMultiplier,
  useRpmCrowd = false,
}: OptimizedCrowdLayerProps) => {
  const groupRefs = useRef<Map<number, THREE.Group>>(new Map());
  const armRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const timeSinceLastUpdate = useRef(0);
  const animationInterval = 1 / 15; // 15fps for crowd animations

  // Calculate merch percentage
  const merchPercentage = useMemo(() => {
    if (bandFame < 500) return 0;
    if (bandFame < 1000) return 5;
    if (bandFame < 2500) return 15;
    if (bandFame < 5000) return 30;
    return 50;
  }, [bandFame]);

  // Generate crowd data with deterministic positions (NOT dependent on crowdMood)
  const crowdData = useMemo(() => {
    const count = Math.floor(maxCrowdCount * densityMultiplier);
    const crowd: CrowdPerson[] = [];

    // Stage is at z < 0, crowd is at z > 0
    const zones = [
      { x: [-8, 8], z: [2, 6], density: 1.0 },
      { x: [-10, 10], z: [6, 10], density: 0.8 },
      { x: [-12, 12], z: [10, 14], density: 0.6 }
    ];

    let currentId = 0;

    for (const zone of zones) {
      const zoneCount = Math.floor((count / 3) * zone.density);

      for (let i = 0; i < zoneCount; i++) {
        const seed = seededRandom(currentId * 7.31 + 0.5);
        const x = zone.x[0] + seededRandom(currentId * 3.14) * (zone.x[1] - zone.x[0]);
        const z = zone.z[0] + seededRandom(currentId * 2.71) * (zone.z[1] - zone.z[0]);
        const baseY = 0;
        
        // Calculate rotation to face the stage (stage is at z = -5 approximately)
        // Crowd is at positive z, stage at negative z, so add PI to face toward stage
        const stageZ = -5;
        const rotationY = Math.atan2(x, z - stageZ) + Math.PI;
        
        crowd.push({
          id: currentId,
          position: [x, baseY, z],
          seed,
          colorVariant: Math.floor(seededRandom(currentId * 4.56) * shirtColors.length),
          showMerch: seededRandom(currentId * 5.67) * 100 < merchPercentage,
          scale: 0.8 + seededRandom(currentId * 1.23) * 0.4,
          baseY,
          hairType: Math.floor(seededRandom(currentId * 8.91) * 5),
          gender: seededRandom(currentId * 6.78) > 0.5 ? 1 : 0,
          accessory: Math.floor(seededRandom(currentId * 9.12) * 4),
          rotationY,
        });

        currentId++;
      }
    }

    return crowd;
  }, [maxCrowdCount, densityMultiplier, merchPercentage]);

  // Determine animation intensity based on mood
  const getAnimationIntensity = (mood: number): { bounce: number; sway: number; jump: number; arms: number } => {
    if (mood < 20) return { bounce: 0.02, sway: 0.05, jump: 0, arms: 0 };
    if (mood < 40) return { bounce: 0.05, sway: 0.1, jump: 0, arms: 0.1 };
    if (mood < 60) return { bounce: 0.1, sway: 0.15, jump: 0.1, arms: 0.3 };
    if (mood < 80) return { bounce: 0.15, sway: 0.2, jump: 0.2, arms: 0.5 };
    return { bounce: 0.2, sway: 0.25, jump: 0.3, arms: 0.8 };
  };

  // Batched animation update - directly manipulate THREE.Group transforms
  useFrame((state, delta) => {
    timeSinceLastUpdate.current += delta;
    
    if (timeSinceLastUpdate.current < animationInterval) return;
    timeSinceLastUpdate.current = 0;

    const time = state.clock.getElapsedTime();
    const intensity = getAnimationIntensity(crowdMood);

    crowdData.forEach((person) => {
      const group = groupRefs.current.get(person.id);
      if (!group) return;

      const phaseOffset = person.seed * 10;
      const animType = Math.floor(person.seed * 5);

      // Animate Y position and rotation directly on the THREE.Group
      switch (animType) {
        case 0: // Idle sway
          group.position.y = person.baseY + Math.sin(time * 0.5 + phaseOffset) * intensity.sway * 0.5;
          group.rotation.y = person.rotationY + Math.sin(time * 0.3 + phaseOffset) * 0.1;
          break;

        case 1: // Bouncing
          group.position.y = person.baseY + Math.abs(Math.sin(time * 2 + phaseOffset)) * intensity.bounce;
          group.rotation.y = person.rotationY;
          break;

        case 2: // Side sway
          group.position.y = person.baseY + Math.sin(time + phaseOffset) * intensity.sway * 0.3;
          group.rotation.y = person.rotationY + Math.sin(time * 0.8 + phaseOffset) * 0.15;
          break;

        case 3: // Jumping (only when mood is high)
          group.position.y = person.baseY + Math.max(0, Math.sin(time * 3 + phaseOffset)) * intensity.jump;
          group.rotation.y = person.rotationY;
          break;

        default: // Head bob
          group.position.y = person.baseY + Math.sin(time * 1.5 + phaseOffset) * intensity.bounce * 0.5;
          group.rotation.y = person.rotationY + Math.sin(time * 2 + phaseOffset) * 0.08;
          break;
      }

      // Animate arms if mood is high enough
      if (intensity.arms > 0.3) {
        const leftArm = armRefs.current.get(`${person.id}-left`);
        const rightArm = armRefs.current.get(`${person.id}-right`);
        
        if (leftArm && animType % 2 === 0) {
          leftArm.rotation.z = 0.3 + Math.sin(time * 2 + phaseOffset) * intensity.arms * 1.5;
        }
        if (rightArm && animType % 2 === 1) {
          rightArm.rotation.z = -0.3 - Math.sin(time * 2 + phaseOffset + 0.5) * intensity.arms * 1.5;
        }
      }
    });
  });

  // Hair component based on type
  const renderHair = (hairType: number, hairColor: string) => {
    switch (hairType) {
      case 0: // Short
        return (
          <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.13, 6, 6]} />
            <meshBasicMaterial color={hairColor} />
          </mesh>
        );
      case 1: // Long
        return (
          <group>
            <mesh position={[0, 1.02, 0]}>
              <sphereGeometry args={[0.13, 6, 6]} />
              <meshBasicMaterial color={hairColor} />
            </mesh>
            <mesh position={[0, 0.85, -0.05]}>
              <capsuleGeometry args={[0.08, 0.2, 2, 4]} />
              <meshBasicMaterial color={hairColor} />
            </mesh>
          </group>
        );
      case 2: // Mohawk
        return (
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.04, 0.15, 0.12]} />
            <meshBasicMaterial color={hairColor} />
          </mesh>
        );
      case 3: // Bald/Buzz
        return null;
      case 4: // Ponytail
        return (
          <group>
            <mesh position={[0, 1.02, 0]}>
              <sphereGeometry args={[0.12, 5, 5]} />
              <meshBasicMaterial color={hairColor} />
            </mesh>
            <mesh position={[0, 0.9, -0.12]} rotation={[0.4, 0, 0]}>
              <capsuleGeometry args={[0.03, 0.15, 2, 4]} />
              <meshBasicMaterial color={hairColor} />
            </mesh>
          </group>
        );
      default:
        return null;
    }
  };

  // Accessory component
  const renderAccessory = (accessory: number) => {
    switch (accessory) {
      case 0: // Glasses
        return (
          <group position={[0, 0.98, 0.12]}>
            <mesh position={[-0.04, 0, 0]}>
              <ringGeometry args={[0.02, 0.03, 6]} />
              <meshBasicMaterial color="#333333" />
            </mesh>
            <mesh position={[0.04, 0, 0]}>
              <ringGeometry args={[0.02, 0.03, 6]} />
              <meshBasicMaterial color="#333333" />
            </mesh>
          </group>
        );
      case 1: // Hat/Cap
        return (
          <mesh position={[0, 1.08, 0.02]}>
            <cylinderGeometry args={[0.12, 0.14, 0.06, 6]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        );
      default:
        return null;
    }
  };

  // Identify front-row crowd members for RPM avatars (first 6 closest to stage)
  const frontRowMembers = useMemo(() => {
    return [...crowdData]
      .sort((a, b) => a.position[2] - b.position[2])
      .slice(0, 6);
  }, [crowdData]);

  const frontRowIds = useMemo(() => new Set(frontRowMembers.map(p => p.id)), [frontRowMembers]);

  // Demo option: render ALL crowd members as RPM avatars (no procedural back rows)
  if (useRpmCrowd) {
    return (
      <group>
        {crowdData.map((person) => (
          <RpmCrowdMember
            key={`rpm-${person.id}`}
            position={person.position}
            avatarUrl={RPM_DEMO_AVATAR}
            scale={person.scale}
            stageZ={-5}
          />
        ))}
      </group>
    );
  }

  return (
    <group>
      {/* All procedural avatars - RPM disabled for performance and consistency */}
      {crowdData.map((person) => {
        // Deterministic appearance based on seed
        const shirtColor = person.showMerch ? bandMerchColor : shirtColors[person.colorVariant % shirtColors.length];
        const pantsColor = pantsColors[Math.floor(person.seed * 7) % pantsColors.length];
        const skinColor = skinTones[Math.floor(person.seed * 13) % skinTones.length];
        const hairColor = hairColors[Math.floor(person.seed * 17) % hairColors.length];
        const bodyWidth = person.gender === 1 ? 0.16 : 0.14;
        const bodyHeight = person.gender === 1 ? 0.55 : 0.5;

        return (
          <group
            key={person.id}
            ref={(group) => {
              if (group) groupRefs.current.set(person.id, group);
            }}
            position={[person.position[0], person.position[1], person.position[2]]}
            rotation={[0, person.rotationY, 0]}
            scale={person.scale}
          >
            {/* Body with better proportions */}
            <mesh position={[0, 0.5, 0]}>
              <capsuleGeometry args={[bodyWidth, bodyHeight, 3, 6]} />
              <meshStandardMaterial color={shirtColor} roughness={0.8} />
            </mesh>

            {/* Neck */}
            <mesh position={[0, 0.85, 0]}>
              <cylinderGeometry args={[0.05, 0.06, 0.1, 6]} />
              <meshBasicMaterial color={skinColor} />
            </mesh>

            {/* Head with better shape */}
            <mesh position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.6} />
            </mesh>

            {/* Face features - simple eyes */}
            <mesh position={[-0.035, 0.97, 0.1]}>
              <sphereGeometry args={[0.015, 4, 4]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
            <mesh position={[0.035, 0.97, 0.1]}>
              <sphereGeometry args={[0.015, 4, 4]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>

            {/* Hair */}
            {renderHair(person.hairType, hairColor)}

            {/* Accessory (for some people) */}
            {person.accessory < 2 && renderAccessory(person.accessory)}

            {/* Arms with animation refs */}
            <mesh
              position={[-0.22, 0.6, 0]}
              rotation={[0, 0, 0.3]}
              ref={(mesh) => {
                if (mesh) armRefs.current.set(`${person.id}-left`, mesh);
              }}
            >
              <capsuleGeometry args={[0.04, 0.32, 2, 4]} />
              <meshBasicMaterial color={skinColor} />
            </mesh>
            <mesh
              position={[0.22, 0.6, 0]}
              rotation={[0, 0, -0.3]}
              ref={(mesh) => {
                if (mesh) armRefs.current.set(`${person.id}-right`, mesh);
              }}
            >
              <capsuleGeometry args={[0.04, 0.32, 2, 4]} />
              <meshBasicMaterial color={skinColor} />
            </mesh>

            {/* Legs with shoes */}
            <mesh position={[-0.08, 0.15, 0]}>
              <capsuleGeometry args={[0.06, 0.32, 2, 4]} />
              <meshBasicMaterial color={pantsColor} />
            </mesh>
            <mesh position={[0.08, 0.15, 0]}>
              <capsuleGeometry args={[0.06, 0.32, 2, 4]} />
              <meshBasicMaterial color={pantsColor} />
            </mesh>

            {/* Shoes */}
            <mesh position={[-0.08, -0.02, 0.02]}>
              <boxGeometry args={[0.08, 0.04, 0.12]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
            <mesh position={[0.08, -0.02, 0.02]}>
              <boxGeometry args={[0.08, 0.04, 0.12]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
