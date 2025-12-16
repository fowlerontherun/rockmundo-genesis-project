import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { EnhancedAvatarCanvas } from "@/components/avatar-system";

interface AvatarPreview3DProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
}

export const AvatarPreview3D = ({ config, autoRotate = false }: AvatarPreview3DProps) => {
  return (
    <EnhancedAvatarCanvas 
      config={config} 
      autoRotate={autoRotate}
      backgroundTheme="gradient"
    />
  );
};
