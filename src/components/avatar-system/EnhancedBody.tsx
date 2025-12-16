import { useMemo } from "react";

interface EnhancedBodyProps {
  skinColor: string;
  bodyType: 'slim' | 'average' | 'muscular' | 'heavy';
  gender: string;
  height: number;
  weight?: number;
  muscleDefinition?: number;
  shoulderWidth?: number;
  hipWidth?: number;
  torsoLength?: number;
  armLength?: number;
  legLength?: number;
  shirtColor: string;
  pantsColor: string;
  shoesColor: string;
  jacketColor?: string;
  hasJacket?: boolean;
}

export const EnhancedBody = ({
  skinColor,
  bodyType,
  gender,
  height,
  weight = 1.0,
  muscleDefinition = 0.5,
  shoulderWidth = 1.0,
  hipWidth = 1.0,
  torsoLength = 1.0,
  armLength = 1.0,
  legLength = 1.0,
  shirtColor,
  pantsColor,
  shoesColor,
  jacketColor,
  hasJacket = false,
}: EnhancedBodyProps) => {
  const dims = useMemo(() => {
    const base = {
      slim: { torsoW: 0.14, torsoD: 0.1, torsoH: 0.4 },
      average: { torsoW: 0.17, torsoD: 0.12, torsoH: 0.42 },
      muscular: { torsoW: 0.2, torsoD: 0.14, torsoH: 0.44 },
      heavy: { torsoW: 0.22, torsoD: 0.16, torsoH: 0.4 },
    };

    const b = base[bodyType] || base.average;
    const weightMod = 0.75 + weight * 0.5;
    const muscleMod = 1 + muscleDefinition * 0.2;

    const isFemale = gender === 'female';

    return {
      torsoW: b.torsoW * weightMod * (isFemale ? 0.9 : muscleMod) * shoulderWidth,
      torsoD: b.torsoD * weightMod,
      torsoH: b.torsoH * torsoLength,
      shoulderW: (isFemale ? 0.22 : 0.26) * shoulderWidth * muscleMod,
      hipW: (isFemale ? 0.19 : 0.16) * hipWidth * weightMod,
      armRadius: (isFemale ? 0.035 : 0.04) * weightMod * muscleMod,
      armLength: 0.32 * armLength,
      legRadius: (isFemale ? 0.055 : 0.06) * weightMod,
      legLength: 0.38 * legLength,
      chestProminence: isFemale ? 0.03 : 0.01 * muscleMod,
    };
  }, [bodyType, gender, weight, muscleDefinition, shoulderWidth, hipWidth, torsoLength, armLength, legLength]);

  const clothingColor = hasJacket && jacketColor ? jacketColor : shirtColor;

  return (
    <group scale={height}>
      {/* === TORSO === */}
      <group position={[0, 1 * torsoLength, 0]}>
        {/* Main torso - higher poly */}
        <mesh castShadow>
          <capsuleGeometry args={[dims.torsoW, dims.torsoH, 12, 24]} />
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </mesh>

        {/* Chest definition */}
        <mesh position={[0, 0.08, dims.torsoD * 0.6]} castShadow>
          <sphereGeometry args={[dims.torsoW * 0.7 + dims.chestProminence, 16, 16]} />
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </mesh>

        {/* Collar detail */}
        <mesh position={[0, dims.torsoH * 0.45, dims.torsoD * 0.3]}>
          <torusGeometry args={[0.06, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color={shirtColor} roughness={0.6} />
        </mesh>

        {/* Jacket overlay */}
        {hasJacket && jacketColor && (
          <>
            <mesh position={[0, 0, 0]} castShadow>
              <capsuleGeometry args={[dims.torsoW + 0.015, dims.torsoH - 0.02, 12, 24]} />
              <meshStandardMaterial color={jacketColor} roughness={0.5} />
            </mesh>
            {/* Jacket collar */}
            <mesh position={[-0.06, dims.torsoH * 0.4, dims.torsoD * 0.5]} rotation={[0, 0.3, 0.2]}>
              <boxGeometry args={[0.04, 0.08, 0.02]} />
              <meshStandardMaterial color={jacketColor} roughness={0.5} />
            </mesh>
            <mesh position={[0.06, dims.torsoH * 0.4, dims.torsoD * 0.5]} rotation={[0, -0.3, -0.2]}>
              <boxGeometry args={[0.04, 0.08, 0.02]} />
              <meshStandardMaterial color={jacketColor} roughness={0.5} />
            </mesh>
            {/* Jacket zipper */}
            <mesh position={[0, 0, dims.torsoW + 0.02]}>
              <boxGeometry args={[0.015, dims.torsoH * 0.8, 0.008]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.3} />
            </mesh>
          </>
        )}
      </group>

      {/* === NECK === */}
      <mesh position={[0, 1.38 * torsoLength, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.12, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* === SHOULDERS === */}
      {/* Left shoulder */}
      <group position={[-dims.shoulderW * 0.9, 1.22 * torsoLength, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={clothingColor} roughness={0.6} />
        </mesh>
        {/* Shoulder muscle definition */}
        <mesh position={[0, 0.02, 0.02]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={clothingColor} roughness={0.65} />
        </mesh>
      </group>
      {/* Right shoulder */}
      <group position={[dims.shoulderW * 0.9, 1.22 * torsoLength, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={clothingColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0.02]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={clothingColor} roughness={0.65} />
        </mesh>
      </group>

      {/* === ARMS === */}
      {/* Left arm */}
      <group position={[-dims.shoulderW, 1.05 * torsoLength, 0]}>
        {/* Upper arm */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0.25]} castShadow>
          <capsuleGeometry args={[dims.armRadius, dims.armLength * 0.5, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {/* Elbow */}
        <mesh position={[-0.06, -0.12, 0]}>
          <sphereGeometry args={[dims.armRadius * 0.9, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {/* Forearm */}
        <mesh position={[-0.1, -0.22, 0]} rotation={[0, 0, 0.15]} castShadow>
          <capsuleGeometry args={[dims.armRadius * 0.85, dims.armLength * 0.45, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {/* Wrist */}
        <mesh position={[-0.14, -0.35, 0]}>
          <sphereGeometry args={[dims.armRadius * 0.6, 10, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {/* Hand */}
        <group position={[-0.16, -0.4, 0]}>
          <mesh>
            <boxGeometry args={[0.05, 0.06, 0.025]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {/* Thumb */}
          <mesh position={[0.025, 0, 0.015]} rotation={[0, 0.3, 0]}>
            <capsuleGeometry args={[0.008, 0.025, 4, 6]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {/* Fingers */}
          {[0.015, 0.005, -0.005, -0.015].map((x, i) => (
            <mesh key={i} position={[x, -0.04, 0]}>
              <capsuleGeometry args={[0.006, 0.02, 4, 6]} />
              <meshStandardMaterial color={skinColor} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Right arm */}
      <group position={[dims.shoulderW, 1.05 * torsoLength, 0]}>
        <mesh position={[0, 0, 0]} rotation={[0, 0, -0.25]} castShadow>
          <capsuleGeometry args={[dims.armRadius, dims.armLength * 0.5, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0.06, -0.12, 0]}>
          <sphereGeometry args={[dims.armRadius * 0.9, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0.1, -0.22, 0]} rotation={[0, 0, -0.15]} castShadow>
          <capsuleGeometry args={[dims.armRadius * 0.85, dims.armLength * 0.45, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0.14, -0.35, 0]}>
          <sphereGeometry args={[dims.armRadius * 0.6, 10, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <group position={[0.16, -0.4, 0]}>
          <mesh>
            <boxGeometry args={[0.05, 0.06, 0.025]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          <mesh position={[-0.025, 0, 0.015]} rotation={[0, -0.3, 0]}>
            <capsuleGeometry args={[0.008, 0.025, 4, 6]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {[-0.015, -0.005, 0.005, 0.015].map((x, i) => (
            <mesh key={i} position={[x, -0.04, 0]}>
              <capsuleGeometry args={[0.006, 0.02, 4, 6]} />
              <meshStandardMaterial color={skinColor} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>

      {/* === BELT === */}
      <mesh position={[0, 0.7 * torsoLength, 0]}>
        <cylinderGeometry args={[dims.hipW + 0.01, dims.hipW + 0.01, 0.045, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Belt buckle */}
      <mesh position={[0, 0.7 * torsoLength, dims.hipW + 0.015]}>
        <boxGeometry args={[0.04, 0.035, 0.01]} />
        <meshStandardMaterial color="#8a8a8a" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* === LEGS === */}
      {/* Left leg */}
      <group position={[-0.08, 0.42 * legLength, 0]}>
        {/* Upper thigh */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <capsuleGeometry args={[dims.legRadius, dims.legLength * 0.45, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        {/* Knee */}
        <mesh position={[0, -0.12, 0.01]}>
          <sphereGeometry args={[dims.legRadius * 0.85, 12, 12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        {/* Lower leg */}
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[dims.legRadius * 0.8, dims.legLength * 0.4, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        {/* Ankle */}
        <mesh position={[0, -0.52, 0]}>
          <sphereGeometry args={[dims.legRadius * 0.5, 10, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[0.08, 0.42 * legLength, 0]}>
        <mesh position={[0, 0.08, 0]} castShadow>
          <capsuleGeometry args={[dims.legRadius, dims.legLength * 0.45, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.12, 0.01]}>
          <sphereGeometry args={[dims.legRadius * 0.85, 12, 12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[dims.legRadius * 0.8, dims.legLength * 0.4, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.52, 0]}>
          <sphereGeometry args={[dims.legRadius * 0.5, 10, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>

      {/* === SHOES === */}
      {/* Left shoe */}
      <group position={[-0.08, 0.06, 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.085, 0.07, 0.15]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        {/* Shoe toe */}
        <mesh position={[0, -0.01, 0.06]}>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        {/* Sole */}
        <mesh position={[0, -0.03, 0]}>
          <boxGeometry args={[0.09, 0.015, 0.16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </group>

      {/* Right shoe */}
      <group position={[0.08, 0.06, 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.085, 0.07, 0.15]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.01, 0.06]}>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <boxGeometry args={[0.09, 0.015, 0.16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
};
