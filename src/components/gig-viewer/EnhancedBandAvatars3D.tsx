import { EnhancedBandMember3D } from "./EnhancedBandMember3D";

interface AvatarConfig {
  skin_tone?: string;
  hair_style_key?: string;
  hair_color?: string;
  shirt_color?: string;
  pants_color?: string;
  shoes_color?: string;
  jacket_color?: string | null;
  body_type?: 'slim' | 'average' | 'muscular' | 'heavy';
  height?: number;
  gender?: string;
  // Ready Player Me
  rpm_avatar_url?: string | null;
  use_rpm_avatar?: boolean;
}

interface EnhancedBandAvatars3DProps {
  songProgress?: number;
  songSection?: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro';
  crowdMood?: number;
  bandMemberConfigs?: {
    vocalist?: AvatarConfig;
    guitarist?: AvatarConfig;
    bassist?: AvatarConfig;
    drummer?: AvatarConfig;
    keyboardist?: AvatarConfig;
  };
}

export const EnhancedBandAvatars3D = ({
  songProgress = 0,
  songSection = 'verse',
  crowdMood = 50,
  bandMemberConfigs = {},
}: EnhancedBandAvatars3DProps) => {
  // Debug logging
  console.log('[EnhancedBandAvatars3D] Rendering with configs:', {
    hasVocalist: !!bandMemberConfigs.vocalist,
    hasGuitarist: !!bandMemberConfigs.guitarist,
    hasBassist: !!bandMemberConfigs.bassist,
    hasDrummer: !!bandMemberConfigs.drummer,
    hasKeyboardist: !!bandMemberConfigs.keyboardist,
    vocalistUrl: bandMemberConfigs.vocalist?.rpm_avatar_url,
  });

  // Determine animation state based on song progress
  const getAnimationState = () => {
    if (songProgress < 0.05) return 'intro';
    if (songProgress > 0.95) return 'outro';
    if (songSection === 'solo') return 'solo';
    return 'playing';
  };

  const animationState = getAnimationState();
  const intensity = crowdMood / 100;

  // Stage positions for band members (x, y, z)
  // Stage floor surface is at y=1.05, avatars have feet at local y=0
  const stageY = 1.1;
  const positions: Record<string, [number, number, number]> = {
    vocalist: [0, stageY, -4],
    guitarist: [-2.5, stageY, -5.5],
    bassist: [2.5, stageY, -5.5],
    drummer: [0, stageY + 0.5, -7.5],
    keyboardist: [-4, stageY, -6],
  };

  return (
    <group>
      {/* Vocalist - center stage */}
      <EnhancedBandMember3D
        position={positions.vocalist}
        instrument="vocalist"
        animationState={animationState}
        intensity={intensity}
        seed={0.1}
        avatarConfig={bandMemberConfigs.vocalist}
      />

      {/* Lead Guitarist - stage left */}
      <EnhancedBandMember3D
        position={positions.guitarist}
        instrument="guitarist"
        animationState={animationState}
        intensity={intensity}
        seed={0.3}
        avatarConfig={bandMemberConfigs.guitarist}
      />

      {/* Bassist - stage right */}
      <EnhancedBandMember3D
        position={positions.bassist}
        instrument="bassist"
        animationState={animationState}
        intensity={intensity}
        seed={0.5}
        avatarConfig={bandMemberConfigs.bassist}
      />

      {/* Drummer - center back */}
      <EnhancedBandMember3D
        position={positions.drummer}
        instrument="drummer"
        animationState={animationState}
        intensity={intensity * 1.2}
        seed={0.7}
        avatarConfig={bandMemberConfigs.drummer}
      />

      {/* Keyboardist - far left (optional) */}
      {bandMemberConfigs.keyboardist && (
        <EnhancedBandMember3D
          position={positions.keyboardist}
          instrument="keyboardist"
          animationState={animationState}
          intensity={intensity * 0.8}
          seed={0.9}
          avatarConfig={bandMemberConfigs.keyboardist}
        />
      )}

      {/* Stage floor markers for band positions */}
      {Object.entries(positions).map(([key, pos]) => {
        if (key === 'keyboardist' && !bandMemberConfigs.keyboardist) return null;
          return (
            <mesh key={key} position={[pos[0], pos[1] + 0.01, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.35, 32]} />
              <meshBasicMaterial color="#3a3a5a" transparent opacity={0.3} />
            </mesh>
          );
      })}
    </group>
  );
};
